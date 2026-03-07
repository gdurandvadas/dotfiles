{
  description = "gedv's deterministic AI-orchestrated dotfiles";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-25.11-darwin";

    home-manager = {
      url = "github:nix-community/home-manager/release-25.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    darwin = {
      url = "github:LnL7/nix-darwin/nix-darwin-25.11";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    mac-app-util.url = "github:hraban/mac-app-util";
  };

  outputs = { self, nixpkgs, home-manager, darwin, mac-app-util, ... }:
  let
    system = "aarch64-darwin";
    pkgs = nixpkgs.legacyPackages.${system};
    # local.nix is gitignored — referenced via absolute path so Nix doesn't
    # require it to be Git-tracked. Requires --impure at evaluation time.
    # We use builtins.getEnv "USER" to determine the home directory dynamically,
    # but fallback to "gedv" if running under sudo (where USER might be root)
    localModule = let
      user = builtins.getEnv "USER";
      homeDir = if user == "root" then "/Users/gedv" else builtins.getEnv "HOME";
    in "${homeDir}/.config/dotfiles/hosts/local.nix";
  in {
    homeConfigurations = {
      "personal" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ 
          ./hosts/personal.nix 
          localModule 
          mac-app-util.homeManagerModules.default
        ];
      };

      "work" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [ 
          ./hosts/work.nix 
          localModule 
          mac-app-util.homeManagerModules.default
        ];
      };
    };

    darwinConfigurations = {
      "workstation" = darwin.lib.darwinSystem {
        inherit system;
        modules = [
          ./hosts/darwin.nix
          mac-app-util.darwinModules.default
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users."gedv" = {
              imports = [ ./hosts/personal.nix localModule ];
            };
            home-manager.sharedModules = [
              mac-app-util.homeManagerModules.default
            ];
          }
        ];
      };
    };
  };
}
