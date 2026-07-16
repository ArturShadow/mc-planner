mod mod_import;
mod database_commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri_plugin_sql::{Migration, MigrationKind};

    let migrations = vec![
        Migration { version: 1, description: "initial", sql: include_str!("../migrations/001_initial.sql"), kind: MigrationKind::Up },
        Migration { version: 2, description: "multiblocks", sql: include_str!("../migrations/002_multiblocks.sql"), kind: MigrationKind::Up },
        Migration { version: 3, description: "base_assignments", sql: include_str!("../migrations/003_base_assignments.sql"), kind: MigrationKind::Up },
        Migration { version: 4, description: "item_catalog", sql: include_str!("../migrations/004_item_catalog.sql"), kind: MigrationKind::Up },
        Migration { version: 5, description: "multiblock_requirements", sql: include_str!("../migrations/005_multiblock_requirements.sql"), kind: MigrationKind::Up },
        Migration { version: 6, description: "indexes", sql: include_str!("../migrations/006_indexes.sql"), kind: MigrationKind::Up },
        Migration { version: 7, description: "seed", sql: include_str!("../migrations/007_seed.sql"), kind: MigrationKind::Up },
        Migration { version: 8, description: "process_editor", sql: include_str!("../migrations/008_process_editor.sql"), kind: MigrationKind::Up },
        Migration { version: 9, description: "base_assignment_groups", sql: include_str!("../migrations/009_base_assignment_groups.sql"), kind: MigrationKind::Up },
        Migration { version: 10, description: "catalog_imports", sql: include_str!("../migrations/010_catalog_imports.sql"), kind: MigrationKind::Up },
        Migration { version: 11, description: "multiblock_shared_walls", sql: include_str!("../migrations/011_multiblock_shared_walls.sql"), kind: MigrationKind::Up },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:mc-planner.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![greet, mod_import::collect_mod_jar_paths, mod_import::scan_mod_jars,
            database_commands::import_catalog_jars, database_commands::create_multiblock_atomic,
            database_commands::update_multiblock_atomic])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
