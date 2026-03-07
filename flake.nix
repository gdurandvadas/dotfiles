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
  in {
    homeConfigurations = {
      "personal" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ ./hosts/workstation.nix ];
      };

      "work" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ ./hosts/work.nix ];
      };
    };
  };
}
