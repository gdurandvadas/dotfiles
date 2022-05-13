function swagger
  docker run --platform linux/amd64 --rm -it  --user (id -u):(id -g) -e GOPATH=$GOPATH -v $HOME:$HOME -w (pwd) quay.io/goswagger/swagger $argv
end
