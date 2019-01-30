function webhost
  git remote add webhost (terminus connection:info --format=list --fields=git_url $argv.dev)
end
