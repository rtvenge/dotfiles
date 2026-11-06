// Which tool this float-* mod opens. main.js is the same in every float-* folder.
export default {
  "mod": "float-files",
  "title": "Find file",
  "run": "f=$(fd --type f --hidden --exclude .git | fzf --preview 'bat --color=always --style=numbers {}') && nvim \"$f\"",
  "oneshot": true
};
