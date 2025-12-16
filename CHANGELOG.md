# 📦 Changelog

## [2.0.0](https://github.com/Im-Not-God/TeleCloud/compare/v1.0.0...v2.0.0) (2025-12-16)


### ⚠ BREAKING CHANGES

* Share link format has changed from object-based to array-based payload structure

### Features

* add multi-channel support ([23a0150](https://github.com/Im-Not-God/TeleCloud/commit/23a0150a1b2678130894f3faab3925cf884ca4f4))
* add password protection for shared files and refactor FileManager layout ([0f28250](https://github.com/Im-Not-God/TeleCloud/commit/0f28250cdee3c421a69903d3dda2bff49e137a60))


### Bug Fixes

* decouple language state from config to prevent unnecessary fetchFiles calls ([9c4bc62](https://github.com/Im-Not-God/TeleCloud/commit/9c4bc62a2f78cbc3a9a3e6d9ac50e8494046a32a))
* **worker:** skip Telegram API calls for folder delete ([ad933b0](https://github.com/Im-Not-God/TeleCloud/commit/ad933b0b694668b44d2ee929adb704ccf57931e6))

## [1.0.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.9.0...v1.0.0) (2025-12-15)


### ⚠ BREAKING CHANGES

* 

### Code Refactoring

* restructure project to src/, use @ for import paths, and migrate to react-router v7 ([8c48ed3](https://github.com/Im-Not-God/TeleCloud/commit/8c48ed3bbef03a3912ceb60a977af0ff7dcb80b5))

## [0.9.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.8.0...v0.9.0) (2025-12-14)


### Features

* enhance Footer component with changelog modal and version check improvements ([3bef6e5](https://github.com/Im-Not-God/TeleCloud/commit/3bef6e5d221512a4291d7f892f526d05a14c65e2))

## [0.8.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.7.0...v0.8.0) (2025-12-14)


### Features

* implement manual version check and update notification in Footer component ([6fe8355](https://github.com/Im-Not-God/TeleCloud/commit/6fe83557498b46160addfd4bb6f73289e18b2b80))

## [0.7.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.6.0...v0.7.0) (2025-12-14)


### Features

* enhance layout and responsiveness of Footer and SharePage components ([8e2c4c2](https://github.com/Im-Not-God/TeleCloud/commit/8e2c4c213080007ce2fac24027b8598858eed478))

## [0.6.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.5.0...v0.6.0) (2025-12-13)


### Features

* add Footer component and integrate version checking in FileManager and SharePage ([f7c6c6c](https://github.com/Im-Not-God/TeleCloud/commit/f7c6c6c8174cc201b1fb20fbe89d5e9e15adf0f9))

## [0.5.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.4.0...v0.5.0) (2025-12-13)


### Features

* add SharePage component for file sharing functionality ([ab20be4](https://github.com/Im-Not-God/TeleCloud/commit/ab20be4811249330ed83b8859592e6ad0a9479ff))
* **FilterMenu:** add internationalization support for filter labels and buttons ([5481857](https://github.com/Im-Not-God/TeleCloud/commit/54818577f3abeeef48d1bb84ea9c3127b9b9a4e8))
* **search:** enhance searchFiles function to support sorting options ([e8dbe59](https://github.com/Im-Not-God/TeleCloud/commit/e8dbe59f8ad0bc0115fbed3353475b18c7869606))
* **SharePage:** enhance sharing functionality with theme and language support ([dc41469](https://github.com/Im-Not-God/TeleCloud/commit/dc414695130ad349ef758ac1be5f652bb6766644))

## [0.4.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.3.0...v0.4.0) (2025-12-13)


### Features

* **FilterMenu:** implement filter menu component with type and time selection ([42bf1c2](https://github.com/Im-Not-God/TeleCloud/commit/42bf1c206fa7ea3b95426ffd6c741634664d74be))

## [0.3.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.2.0...v0.3.0) (2025-12-13)


### Features

* **search:** add highlighting, filtering, and sorting support ([43e4123](https://github.com/Im-Not-God/TeleCloud/commit/43e41238d23c516574a121421a5327ef75e8f50f))

## [0.2.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.1.0...v0.2.0) (2025-12-11)


### Features

* Implement comprehensive download and upload enhancements with progress tracking ([50ccbc9](https://github.com/Im-Not-God/TeleCloud/commit/50ccbc91271fd56d992a710488332c8cb0ed3f32))

## [0.1.0](https://github.com/Im-Not-God/TeleCloud/compare/v0.0.1...v0.1.0) (2025-12-11)


### Features

* add GitHub Actions workflow for automated releases ([189b873](https://github.com/Im-Not-God/TeleCloud/commit/189b873c2142d43a49d5a98de8330d3dc6cdc827))

### 0.0.1 (2025-12-11)

### ✨ Features

- Add deploy and publish scripts for Wrangler integration ([a3e3f4a](https://github.com/Im-Not-God/TeleCloud/commit/a3e3f4ac805d6f4de1321934d5ef010e67ce93c4))
- add internationalization support and language translations for English and Chinese. ([d3f9e5f](https://github.com/Im-Not-God/TeleCloud/commit/d3f9e5ffb3d43808e8684a0a9c16553d05ec98d3))
- Implement file slicing and downloading for large files ([da3ee13](https://github.com/Im-Not-God/TeleCloud/commit/da3ee13cc2656dc05e3f46bf66589e0dba9ac2ad))

### 🧹 Chores

- update dependencies and add linting configuration ([93fa3b4](https://github.com/Im-Not-God/TeleCloud/commit/93fa3b42de7f306da9bb4bec385fee7848027a5d))
- update dependencies in package.json ([4092494](https://github.com/Im-Not-God/TeleCloud/commit/40924949aefe6ece37fe1948bc01945648a7e35a))
