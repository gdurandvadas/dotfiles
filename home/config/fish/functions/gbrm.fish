function gbrm
  git fetch -p && for b in (git branch -vv | grep ': gone]' | awk '{print $1}'); git branch -D $b; end
end
