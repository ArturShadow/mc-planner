use serde::Deserialize;
use sqlx::Sqlite;
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};

use crate::mod_import::JarAnalysis;
use std::{fs, path::PathBuf};

const DATABASE_URL: &str = "sqlite:mc-planner.db";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequirementInput { item_id: i64, quantity: i64 }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultiblockInput {
    name: String,
    width_blocks: i64,
    depth_blocks: i64,
    height_blocks: i64,
    can_share_walls: bool,
    requirements: Vec<RequirementInput>,
}

async fn transaction<'a>(instances: &'a DbInstances) -> Result<sqlx::Transaction<'a, Sqlite>, String> {
    let pools = instances.0.read().await;
    let pool = match pools.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => pool.clone(),
        _ => return Err("The catalog database is not loaded.".into()),
    };
    drop(pools);
    pool.begin().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn import_catalog_jars(
    instances: State<'_, DbInstances>, project_id: i64, minecraft_version: String, analyses: Vec<JarAnalysis>,
) -> Result<u64, String> {
    let mut tx = transaction(&instances).await?;
    let mut imported = 0;
    for analysis in analyses {
        sqlx::query(
            r#"INSERT INTO catalog_sources
              (project_id, source_type, source_identifier, display_name, minecraft_version, adds_catalog_content, content_hash, mod_version, source_path)
             VALUES (?, 'mod', ?, ?, ?, 1, ?, ?, ?)
             ON CONFLICT(project_id, source_type, source_identifier) DO UPDATE SET
               display_name = excluded.display_name, minecraft_version = excluded.minecraft_version,
               content_hash = excluded.content_hash, mod_version = excluded.mod_version, source_path = excluded.source_path"#,
        ).bind(project_id).bind(&analysis.mod_id).bind(&analysis.mod_name)
            .bind(if minecraft_version.is_empty() { None } else { Some(minecraft_version.as_str()) })
            .bind(&analysis.content_hash).bind(&analysis.mod_version).bind(&analysis.path)
            .execute(&mut *tx).await.map_err(|error| error.to_string())?;
        for block in analysis.blocks {
            let result = sqlx::query(
                r#"INSERT OR IGNORE INTO item_catalog
                  (name, mod_name, item_identifier, category, minecraft_version, source_type, source_id)
                 VALUES (?, ?, ?, ?, ?, 'mod', ?)"#,
            ).bind(block.name).bind(&analysis.mod_name).bind(block.item_identifier).bind(block.category)
                .bind(if minecraft_version.is_empty() { None } else { Some(minecraft_version.as_str()) })
                .bind(&analysis.mod_id).execute(&mut *tx).await.map_err(|error| error.to_string())?;
            imported += result.rows_affected();
        }
    }
    tx.commit().await.map_err(|error| error.to_string())?;
    Ok(imported)
}

async fn replace_requirements(
    tx: &mut sqlx::Transaction<'_, Sqlite>, multiblock_id: i64, requirements: Vec<RequirementInput>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM multiblock_requirements WHERE multiblock_id = ?")
        .bind(multiblock_id).execute(&mut **tx).await.map_err(|error| error.to_string())?;
    for requirement in requirements {
        sqlx::query("INSERT INTO multiblock_requirements (multiblock_id, item_id, quantity) VALUES (?, ?, ?)")
            .bind(multiblock_id).bind(requirement.item_id).bind(requirement.quantity)
            .execute(&mut **tx).await.map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn create_multiblock_atomic(instances: State<'_, DbInstances>, input: MultiblockInput) -> Result<(), String> {
    let mut tx = transaction(&instances).await?;
    let symbol = input.name.trim().chars().next().unwrap_or('M').to_uppercase().to_string();
    let result = sqlx::query(
        "INSERT INTO multiblocks (name, symbol, width_blocks, depth_blocks, height_blocks, can_share_walls) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(input.name.trim()).bind(symbol).bind(input.width_blocks).bind(input.depth_blocks)
        .bind(input.height_blocks).bind(input.can_share_walls).execute(&mut *tx).await.map_err(|error| error.to_string())?;
    replace_requirements(&mut tx, result.last_insert_rowid(), input.requirements).await?;
    tx.commit().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn update_multiblock_atomic(instances: State<'_, DbInstances>, id: i64, input: MultiblockInput) -> Result<(), String> {
    let mut tx = transaction(&instances).await?;
    let symbol = input.name.trim().chars().next().unwrap_or('M').to_uppercase().to_string();
    sqlx::query(
        "UPDATE multiblocks SET name = ?, symbol = ?, width_blocks = ?, depth_blocks = ?, height_blocks = ?, can_share_walls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(input.name.trim()).bind(symbol).bind(input.width_blocks).bind(input.depth_blocks)
        .bind(input.height_blocks).bind(input.can_share_walls).bind(id).execute(&mut *tx).await.map_err(|error| error.to_string())?;
    replace_requirements(&mut tx, id, input.requirements).await?;
    tx.commit().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_catalog_manifest(path: String, manifest: serde_json::Value) -> Result<(), String> {
    let path = PathBuf::from(path);
    let contents = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(path, contents).map_err(|error| error.to_string())
}
