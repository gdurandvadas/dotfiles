{
  description = "gedv's deterministic AI-orchestrated dotfiles";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, ... }:
  let
    system = "aarch64-darwin";
    pkgs = nixpkgs.legacyPackages.${system};
    # local.nix is gitignored — referenced via absolute path so Nix doesn't
    # require it to be Git-tracked. Requires --impure at evaluation time.
    localModule = "${builtins.getEnv "HOME"}/.config/dotfiles/hosts/local.nix";
  in {
    homeConfigurations = {
      "personal" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ ./hosts/personal.nix localModule ];
      };

      "work" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ ./hosts/work.nix localModule ];
      };
    };
  };
}
