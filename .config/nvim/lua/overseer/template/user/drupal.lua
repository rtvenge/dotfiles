-- Zed tasks.json: "Clear Drupal Cache" (cd $ZED_WORKTREE_ROOT && drush cr).
-- Run it with <leader>oo (:OverseerRun).
--
-- `drush` in the shell is the oh-my-zsh lando plugin's wrapper function, not a
-- binary, and overseer doesn't go through an interactive zsh -- so the same
-- routing is done here: lando when the project has a .lando.yml, otherwise the
-- project's own vendor/bin/drush, otherwise a global drush.

---@type overseer.TemplateFileProvider
return {
  generator = function(opts)
    local lando = vim.fs.find(".lando.yml", { upward = true, type = "file", path = opts.dir })[1]
    if lando and vim.fn.executable("lando") == 1 then
      return {
        {
          name = "Clear Drupal Cache",
          builder = function()
            return { cmd = { "lando", "drush", "cr" }, cwd = vim.fs.dirname(lando) }
          end,
        },
      }
    end

    local composer = vim.fs.find("composer.json", { upward = true, type = "file", path = opts.dir })[1]
    local root = composer and vim.fs.dirname(composer)
    local project_drush = root and (root .. "/vendor/bin/drush")
    local drush = project_drush and vim.uv.fs_stat(project_drush) and project_drush
      or (vim.fn.executable("drush") == 1 and "drush")
    if not drush then
      return "drush not found"
    end

    return {
      {
        name = "Clear Drupal Cache",
        builder = function()
          return { cmd = { drush, "cr" }, cwd = root or opts.dir }
        end,
      },
    }
  end,
}
