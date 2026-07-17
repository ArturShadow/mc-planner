# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- A catalog workspace that previews and imports localized block names from Fabric, Forge, and NeoForge JAR files or mods folders.
- Mod JAR analysis now runs in responsive batches and skips archives without block language entries.
- Multiblocks can be created with a manual list of required catalog blocks and quantities.
- Multiblocks can declare that instances of the same type may share walls.
- Multiblocks can be updated or deleted from the catalog.

### Fixed

- Large catalog imports now use a real single-connection transaction instead of failing with “cannot rollback - no transaction is active”.
- The multiblock block picker now stays within the dialog, supports text filtering, and progressively renders large catalogs.
- The multiblock block picker groups available blocks by mod, with separate Minecraft and manual categories.
- Imported sources and multiblocks use independent bounded scroll areas.
- The process editor uses a Photoshop-style tool palette with searchable, grouped, progressively loaded placement elements.
- Import previews use one expandable, progressively rendered block list per mod and can export a reusable JSON analysis manifest.

### Added

- Repository contribution, branching, testing, code, CSS, changelog, and release guidelines.
- A 2D process editor with rectangular chunk grids, grouped catalog tools, multiblock footprints, and persistent placements.

## [0.1.0]

The project currently reports version `0.1.0`. No historical changelog was maintained before this file was introduced.
