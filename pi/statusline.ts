/**
 * Status line — port of the Claude Code status line (dotfiles/claude/statusline.sh).
 *
 * Replaces pi's footer with an oh-my-posh render of statusline.omp.json:
 *   left  — cwd + git branch/status
 *   right — model, context usage, lines changed, cost, session duration
 *
 * Claude feeds its statusline script a JSON payload; pi has no such hook, so the
 * same values are pulled off the extension context and handed to oh-my-posh as
 * PI_STATUS_* env vars (the theme is the Claude theme with the prefix renamed).
 */

import { execFile } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/** How often the line is re-rendered while the agent is streaming. */
const REFRESH_MS = 1000;
/** oh-my-posh shells out to git; don't let a slow repo wedge the footer. */
const RENDER_TIMEOUT_MS = 3000;

type Stats = { cost: number; added: number; removed: number };

function moduleDir(): string | undefined {
	try {
		// realpath so the theme is found when this file is symlinked into ~/.pi/agent/extensions
		return dirname(realpathSync(fileURLToPath(import.meta.url)));
	} catch {
		return undefined;
	}
}

function findTheme(): string | undefined {
	const here = moduleDir();
	const candidates = [
		process.env.PI_STATUSLINE_THEME,
		here ? join(here, "statusline.omp.json") : undefined,
		join(homedir(), "dotfiles", "pi", "statusline.omp.json"),
	];
	return candidates.find((path): path is string => !!path && existsSync(path));
}

function formatTokens(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}m`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
	return String(Math.round(count));
}

function formatCost(usd: number): string {
	if (!usd) return "";
	return usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2);
}

function formatDuration(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function countLines(text: string): number {
	if (!text) return 0;
	const lines = text.split("\n");
	if (lines[lines.length - 1] === "") lines.pop();
	return lines.length;
}

/** Count +/- lines in a unified diff, ignoring the ---/+++ file headers. */
function countPatch(patch: string | undefined, stats: Stats): void {
	if (!patch) return;
	for (const line of patch.split("\n")) {
		if (line.startsWith("+++") || line.startsWith("---")) continue;
		if (line.startsWith("+")) stats.added++;
		else if (line.startsWith("-")) stats.removed++;
	}
}

/**
 * Walk the whole session (not just the current branch) for cost and edited lines,
 * mirroring how pi's built-in footer totals usage.
 */
function scanSession(ctx: ExtensionContext): Stats {
	const stats: Stats = { cost: 0, added: 0, removed: 0 };
	const writeContent = new Map<string, string>();

	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "compaction" || entry.type === "branch_summary") {
			stats.cost += entry.usage?.cost?.total ?? 0;
			continue;
		}
		if (entry.type !== "message") continue;

		const message = entry.message;
		if (message.role === "assistant") {
			stats.cost += message.usage?.cost?.total ?? 0;
			for (const part of message.content) {
				if (part.type === "toolCall" && part.name === "write" && typeof part.arguments?.content === "string") {
					writeContent.set(part.id, part.arguments.content);
				}
			}
		} else if (message.role === "toolResult") {
			stats.cost += message.usage?.cost?.total ?? 0;
			if (message.isError) continue;
			if (message.toolName === "edit") {
				countPatch((message.details as { patch?: string } | undefined)?.patch, stats);
			} else if (message.toolName === "write") {
				stats.added += countLines(writeContent.get(message.toolCallId) ?? "");
			}
		}
	}
	return stats;
}

function statusEnv(ctx: ExtensionContext, startedAt: number): Record<string, string> {
	const stats = scanSession(ctx);
	const usage = ctx.getContextUsage();

	let context = "";
	if (usage) {
		const window = usage.contextWindow ? formatTokens(usage.contextWindow) : "?";
		const tokens = usage.tokens === null ? "?" : formatTokens(usage.tokens);
		const percent = usage.percent === null ? "" : ` ${usage.percent.toFixed(0)}%`;
		context = `${tokens}/${window}${percent}`;
	}

	return {
		PI_STATUS_MODEL: ctx.model ? ctx.model.name || ctx.model.id : "",
		PI_STATUS_CONTEXT: context,
		PI_STATUS_COST: formatCost(stats.cost),
		PI_STATUS_DURATION: formatDuration(Date.now() - startedAt),
		PI_STATUS_CHANGES: stats.added || stats.removed ? `+${stats.added}/-${stats.removed}` : "",
	};
}

/** Timestamp of the first message in the session, so `-c`/`-r` keeps counting from the start. */
function sessionStartedAt(ctx: ExtensionContext): number {
	for (const entry of ctx.sessionManager.getEntries()) {
		if (entry.type === "message" && typeof entry.message.timestamp === "number") {
			return entry.message.timestamp;
		}
	}
	return Date.now();
}

export default function (pi: ExtensionAPI) {
	let enabled = true;
	let themePath: string | undefined;
	let startedAt = Date.now();
	let timer: ReturnType<typeof setInterval> | undefined;

	// Rendering state shared between the footer component and the refresh loop.
	let line: string | undefined;
	let width = 0;
	let inFlight = false;
	let wasBusy = false;
	let requestRender: (() => void) | undefined;
	let context: ExtensionContext | undefined;

	function render(): void {
		if (!enabled || !themePath || !context || inFlight || width <= 0) return;
		inFlight = true;
		const cwd = context.sessionManager.getCwd() || context.cwd;
		execFile(
			"oh-my-posh",
			["print", "primary", "--config", themePath, "--pwd", cwd, "--terminal-width", String(width)],
			{
				env: { ...process.env, ...statusEnv(context, startedAt) },
				timeout: RENDER_TIMEOUT_MS,
				maxBuffer: 1024 * 1024,
			},
			(error, stdout) => {
				inFlight = false;
				if (error) {
					// oh-my-posh missing or broken: hand the footer back to pi rather than showing a blank line.
					if ((error as NodeJS.ErrnoException).code === "ENOENT") teardown("oh-my-posh not found");
					return;
				}
				// final_space in the theme puts one column past --terminal-width; drop it.
				const next = (stdout.split("\n")[0] ?? "").replace(/\s+$/, "");
				if (next === line) return;
				line = next;
				requestRender?.();
			},
		);
	}

	function teardown(reason?: string): void {
		if (timer) clearInterval(timer);
		timer = undefined;
		line = undefined;
		context?.ui.setFooter(undefined);
		if (reason) context?.ui.notify(`statusline disabled: ${reason}`, "warning");
	}

	function install(ctx: ExtensionContext): void {
		if (timer) clearInterval(timer); // session switch: don't stack refresh loops
		timer = undefined;
		wasBusy = false;
		context = ctx;
		themePath = findTheme();
		if (!themePath) {
			ctx.ui.notify("statusline: statusline.omp.json not found, using default footer", "warning");
			return;
		}
		startedAt = sessionStartedAt(ctx);
		line = undefined;

		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			// Branch changed: keep showing the stale line until the re-render lands.
			const unsubscribe = footerData.onBranchChange(() => render());

			return {
				dispose() {
					unsubscribe();
					requestRender = undefined;
				},
				invalidate() {},
				render(available: number): string[] {
					if (available !== width) {
						width = available;
						render();
					}
					if (line === undefined) return [theme.fg("dim", "…")];
					return [visibleWidth(line) > available ? truncateToWidth(line, available, "") : line];
				},
			};
		});

		// Tick while the agent is streaming so the clock moves, plus one final tick
		// on the way back to idle. Idle sessions stay quiet (oh-my-posh shells out to git).
		timer = setInterval(() => {
			if (!context) return;
			const busy = !context.isIdle();
			if (busy || wasBusy) {
				wasBusy = busy;
				render();
			}
		}, REFRESH_MS);
		timer.unref?.();

		render();
	}

	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode !== "tui" || !enabled) return;
		install(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		context = ctx;
		render();
	});

	pi.on("session_shutdown", async () => {
		teardown();
	});

	pi.registerCommand("statusline", {
		description: "Toggle the oh-my-posh status line",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			if (enabled) {
				install(ctx);
				ctx.ui.notify("statusline enabled", "info");
			} else {
				teardown();
				ctx.ui.notify("statusline disabled (default footer restored)", "info");
			}
		},
	});
}
