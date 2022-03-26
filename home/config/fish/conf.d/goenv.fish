set -gx GOV (asdf where golang)
set -gx GOROOT $GOV/go
set -gx GOPATH $HOME/go

set PATH $GOPATH/bin $PATH