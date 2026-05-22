# Pi Global Guidance

This Home Manager profile installs Pi through the pinned Nix package
`pkgs.pi-coding-agent`. Keep global Pi configuration small and avoid storing
provider tokens, API keys, personal identity, or project-specific rules here.

Prefer project-local `apps/pi/project/` settings, extensions, skills, and
context files for repository-specific behavior. The root `.pi/` directory is
only a discovery shim.
