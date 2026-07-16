use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, HashSet}, fs, io::{Read, Seek}, path::{Path, PathBuf}};
use zip::ZipArchive;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedBlock {
    pub name: String,
    pub item_identifier: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JarAnalysis {
    pub path: String,
    pub file_name: String,
    pub content_hash: String,
    pub mod_id: String,
    pub mod_name: String,
    pub mod_version: Option<String>,
    pub blocks: Vec<ImportedBlock>,
    pub warnings: Vec<String>,
    pub error: Option<String>,
}

#[derive(Default)]
struct ModMetadata { id: String, name: String, version: Option<String> }

#[tauri::command]
pub fn scan_mod_jars(paths: Vec<String>, locale: String) -> Vec<JarAnalysis> {
    collect_jar_paths(paths).into_iter().filter_map(|path| {
        let analysis = analyze_jar(&path, &locale);
        (analysis.error.is_some() || !analysis.blocks.is_empty()).then_some(analysis)
    }).collect()
}

#[tauri::command]
pub fn collect_mod_jar_paths(paths: Vec<String>) -> Vec<String> {
    collect_jar_paths(paths).into_iter().map(|path| path.to_string_lossy().into_owned()).collect()
}

fn collect_jar_paths(paths: Vec<String>) -> Vec<PathBuf> {
    let mut found = Vec::new();
    let mut seen = HashSet::new();
    for raw in paths {
        let path = PathBuf::from(raw);
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(&path) {
                let mut children: Vec<_> = entries.flatten().map(|entry| entry.path()).collect();
                children.sort();
                for child in children { push_jar(child, &mut found, &mut seen); }
            }
        } else { push_jar(path, &mut found, &mut seen); }
    }
    found
}

fn push_jar(path: PathBuf, found: &mut Vec<PathBuf>, seen: &mut HashSet<String>) {
    if !path.is_file() || !path.extension().is_some_and(|value| value.eq_ignore_ascii_case("jar")) { return; }
    let normalized = fs::canonicalize(&path).unwrap_or(path);
    let key = normalized.to_string_lossy().to_lowercase();
    if seen.insert(key) { found.push(normalized); }
}

fn analyze_jar(path: &Path, locale: &str) -> JarAnalysis {
    let file_name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) => return failed(path, file_name, format!("Could not read file: {error}")),
    };
    let content_hash = Sha256::digest(&bytes).iter().map(|byte| format!("{byte:02x}")).collect();
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = match ZipArchive::new(cursor) {
        Ok(archive) => archive,
        Err(error) => return failed(path, file_name, format!("Invalid JAR/ZIP: {error}")),
    };
    let mut warnings = Vec::new();
    let metadata = read_metadata(&mut archive).unwrap_or_else(|| {
        warnings.push("No Fabric, Forge, or NeoForge metadata was found; the filename is used as the mod identifier.".into());
        let stem = path.file_stem().unwrap_or_default().to_string_lossy().into_owned();
        ModMetadata { id: stem.to_lowercase().replace([' ', '-'], "_"), name: stem, version: None }
    });
    let mut names = read_language(&mut archive, "en_us");
    if locale != "en_us" { names.extend(read_language(&mut archive, locale)); }
    if names.is_empty() { warnings.push(format!("No block translations were found for {locale} or en_us.")); }
    let blocks = names.into_iter().map(|(identifier, name)| ImportedBlock { name, item_identifier: identifier }).collect();
    JarAnalysis {
        path: path.to_string_lossy().into_owned(), file_name, content_hash,
        mod_id: metadata.id, mod_name: metadata.name, mod_version: metadata.version,
        blocks, warnings, error: None,
    }
}

fn failed(path: &Path, file_name: String, error: String) -> JarAnalysis {
    JarAnalysis { path: path.to_string_lossy().into_owned(), file_name, content_hash: String::new(), mod_id: String::new(), mod_name: String::new(), mod_version: None, blocks: vec![], warnings: vec![], error: Some(error) }
}

fn read_entry<R: Read + Seek>(archive: &mut ZipArchive<R>, name: &str) -> Option<String> {
    let mut entry = archive.by_name(name).ok()?;
    let mut value = String::new();
    entry.read_to_string(&mut value).ok()?;
    Some(value)
}

fn read_metadata<R: Read + Seek>(archive: &mut ZipArchive<R>) -> Option<ModMetadata> {
    if let Some(raw) = read_entry(archive, "fabric.mod.json") {
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) {
            let id = value.get("id")?.as_str()?.to_owned();
            let name = value.get("name").and_then(|v| v.as_str()).unwrap_or(&id).to_owned();
            let version = value.get("version").and_then(|v| v.as_str()).map(str::to_owned);
            return Some(ModMetadata { id, name, version });
        }
    }
    for name in ["META-INF/neoforge.mods.toml", "META-INF/mods.toml"] {
        if let Some(raw) = read_entry(archive, name) {
            if let Ok(value) = toml::from_str::<toml::Value>(&raw) {
                if let Some(mod_entry) = value.get("mods").and_then(|v| v.as_array()).and_then(|v| v.first()) {
                    let id = mod_entry.get("modId")?.as_str()?.to_owned();
                    let display_name = mod_entry.get("displayName").and_then(|v| v.as_str()).unwrap_or(&id).to_owned();
                    let version = mod_entry.get("version").and_then(|v| v.as_str()).map(str::to_owned);
                    return Some(ModMetadata { id, name: display_name, version });
                }
            }
        }
    }
    None
}

fn read_language<R: Read + Seek>(archive: &mut ZipArchive<R>, locale: &str) -> BTreeMap<String, String> {
    let suffix = format!("/lang/{locale}.json");
    let entry_names: Vec<String> = (0..archive.len()).filter_map(|index| {
        let name = archive.by_index(index).ok()?.name().to_owned();
        (name.starts_with("assets/") && name.ends_with(&suffix)).then_some(name)
    }).collect();
    let mut blocks = BTreeMap::new();
    for entry_name in entry_names {
        let Some(raw) = read_entry(archive, &entry_name) else { continue };
        let Ok(entries) = serde_json::from_str::<BTreeMap<String, String>>(&raw) else { continue };
        for (key, value) in entries {
            let mut parts = key.splitn(3, '.');
            if parts.next() == Some("block") {
                if let (Some(namespace), Some(id)) = (parts.next(), parts.next()) {
                    blocks.insert(format!("{namespace}:{id}"), value);
                }
            }
        }
    }
    blocks
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn jar(entries: &[(&str, &str)]) -> tempfile::NamedTempFile {
        let file = tempfile::Builder::new().suffix(".jar").tempfile().unwrap();
        let mut writer = zip::ZipWriter::new(file.reopen().unwrap());
        for (name, value) in entries {
            writer.start_file(*name, zip::write::SimpleFileOptions::default()).unwrap();
            writer.write_all(value.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
        file
    }

    #[test]
    fn reads_fabric_metadata_and_locale_with_english_fallback() {
        let file = jar(&[
            ("fabric.mod.json", r#"{"id":"example","name":"Example Mod","version":"1.2"}"#),
            ("assets/example/lang/en_us.json", r#"{"block.example.machine":"Machine","item.example.part":"Part"}"#),
            ("assets/example/lang/es_mx.json", r#"{"block.example.machine":"Máquina"}"#),
        ]);
        let result = analyze_jar(file.path(), "es_mx");
        assert_eq!(result.mod_id, "example");
        assert_eq!(result.blocks[0].name, "Máquina");
        assert_eq!(result.blocks[0].item_identifier, "example:machine");
    }

    #[test]
    fn scans_only_first_level_and_deduplicates_paths() {
        let directory = tempfile::tempdir().unwrap();
        let first = directory.path().join("first.jar");
        fs::write(&first, b"jar").unwrap();
        let nested = directory.path().join("nested");
        fs::create_dir(&nested).unwrap();
        fs::write(nested.join("second.jar"), b"jar").unwrap();
        let paths = collect_jar_paths(vec![directory.path().to_string_lossy().into(), first.to_string_lossy().into()]);
        assert_eq!(paths.len(), 1);
    }

    #[test]
    fn reads_forge_and_neoforge_metadata() {
        for metadata_path in ["META-INF/mods.toml", "META-INF/neoforge.mods.toml"] {
            let file = jar(&[(metadata_path, r#"[[mods]]
modId="machines"
displayName="Machines"
version="2.0"
"#), ("assets/machines/lang/en_us.json", r#"{"block.machines:ignored":"Ignored","block.machines.press":"Press"}"#)]);
            let result = analyze_jar(file.path(), "en_us");
            assert_eq!(result.mod_id, "machines");
            assert_eq!(result.mod_name, "Machines");
            assert_eq!(result.mod_version.as_deref(), Some("2.0"));
            assert_eq!(result.blocks[0].item_identifier, "machines:press");
        }
    }

    #[test]
    fn reports_an_invalid_jar_without_panicking() {
        let file = tempfile::Builder::new().suffix(".jar").tempfile().unwrap();
        fs::write(file.path(), b"not a zip").unwrap();
        let result = analyze_jar(file.path(), "en_us");
        assert!(result.error.as_deref().unwrap().contains("Invalid JAR/ZIP"));
    }

    #[test]
    fn skips_valid_jars_without_block_language_entries() {
        let file = jar(&[("fabric.mod.json", r#"{"id":"library","name":"Library","version":"1"}"#)]);
        let result = scan_mod_jars(vec![file.path().to_string_lossy().into()], "en_us".into());
        assert!(result.is_empty());
    }
}
