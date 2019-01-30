function gitsync
  git checkout $argv
  git pull webhost $argv
  git pull origin $argv
  git push webhost $argv
  git push origin $argv
end
