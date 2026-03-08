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
  };

  outputs = { self, nixpkgs, home-manager, darwin, ... }:
  let
    system = "aarch64-darwin";
    unfree = import ./unfree-packages.nix;
    pkgs = import nixpkgs {
      inherit system;
      config.allowUnfreePredicate = pkg: builtins.elem (nixpkgs.lib.getName pkg) unfree.base;
    };
    # local.nix is gitignored — referenced via absolute path so Nix doesn't
    # require it to be Git-tracked. Requires --impure at evaluation time.
    # Uses DOTFILES_DIR env var so the path resolves correctly even when
    # nix-darwin activation runs as root and nix resets HOME to /var/root.
    dotfilesDir =
      let d = builtins.getEnv "DOTFILES_DIR"; in
      if d != "" then d else "${builtins.getEnv "HOME"}/.config/dotfiles";
    localModule = "${dotfilesDir}/hosts/local.nix";

    # Home-manager switch apps: use flake's home-manager so version stays in one place.
    hmPkg = home-manager.packages.${system}.default;
    hmSwitch = profile: self.lib.mkApp (pkgs.writeShellScriptBin "hm-switch" ''
      set -e
      export DOTFILES_DIR="''${DOTFILES_DIR:-$HOME/.config/dotfiles}"
      exec "${hmPkg}/bin/home-manager" switch --flake "$DOTFILES_DIR#${profile}" --impure "$@"
    '');
  in {
    lib = {
      mkApp = drv: { type = "app"; program = "${drv}/bin/${drv.pname or (builtins.parseDrvName drv.name).name}"; };
    };

    apps.${system} = {
      switch-personal = hmSwitch "personal";
      switch-work = hmSwitch "work";
    };

    # Shell with 1Password CLI for bootstrap (uses flake's allowUnfree).
    devShells.${system}.bootstrap = pkgs.mkShell {
      buildInputs = [ pkgs._1password-cli ];
    };

    homeConfigurations = {
      "personal" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          ./hosts/personal.nix
          localModule
        ];
      };

      "work" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          ./hosts/work.nix
          localModule
        ];
      };
    };

    # Note: Building may show a warning about 'options.json' and store path context.
    # This comes from nix-darwin/nixpkgs option docs and is safe to ignore for now.
    darwinConfigurations = {
      "workstation" = darwin.lib.darwinSystem {
        inherit system;
        specialArgs = { inherit self; };
        modules = [
          ./modules/user.nix
          localModule
          ./hosts/darwin.nix
          home-manager.darwinModules.home-manager
          {
            home-manager.useGlobalPkgs = true;
            home-manager.useUserPackages = true;
            home-manager.users = let u = (import localModule { }).my.user or {}; username = u.username or "gedv"; in {
              ${username} = {
                imports = [ ./hosts/personal.nix localModule ];
              };
            };
            home-manager.sharedModules = [ ];
          }
        ];
      };
    };
  };
}
