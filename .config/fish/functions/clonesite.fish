function clonesite
  cd ~/Sites/lando
  git clone git@gitlab.com:hoverboard88/client-sites/$argv.git
  cd $argv
  webhost $argv
  lando start
  lando pull --code=none --database=live --files=live
end
