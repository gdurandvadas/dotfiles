function gbrm
  git remote prune origin && git branch --merged | egrep -v "(^\*|master)" | xargs git branch -d
end
