// Research Board's desktop app: a window showing src/ (the same app as in the browser), plus the two things its
// JavaScript can't do in a web view: run SQL on a SQLite file, and keep files in a folder. These commands are
// the adapter that src/script/core/place/sql-tauri.js hands to place.js; all the storage logic stays in place.js.
//
// The data: research-board.db and files/<hash> in the app's data folder
// (Windows: %APPDATA%\com.researchboard.desktop).

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params_from_iter, types::Value as SqlValue, types::ValueRef, Connection};
use serde_json::{Map, Value};
use std::{fs, path::PathBuf, sync::Mutex};
use tauri::{
    ipc::{InvokeBody, Request, Response},
    Manager, State,
};

struct Data {
    db: Mutex<Connection>,
    dir: PathBuf,
    files: PathBuf,
}

type Answer<T> = Result<T, String>;
fn text<E: ToString>(err: E) -> String {
    err.to_string()
}

fn to_sql(value: &Value) -> SqlValue {
    match value {
        Value::Null => SqlValue::Null,
        Value::Bool(b) => SqlValue::Integer(*b as i64),
        Value::Number(n) => n.as_i64().map(SqlValue::Integer).unwrap_or_else(|| SqlValue::Real(n.as_f64().unwrap_or(0.0))),
        Value::String(s) => SqlValue::Text(s.clone()),
        other => SqlValue::Text(other.to_string()),
    }
}

fn to_json(value: ValueRef) -> Value {
    match value {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => i.into(),
        ValueRef::Real(f) => f.into(),
        ValueRef::Text(t) => String::from_utf8_lossy(t).into(),
        ValueRef::Blob(b) => b.to_vec().into(),
    }
}

// A page opening the database: a write that a closed page left half done (it was never confirmed, and is
// still in that page's outbox) is undone.
#[tauri::command]
fn sql_open(data: State<Data>) -> Answer<String> {
    let db = data.db.lock().map_err(text)?;
    if !db.is_autocommit() {
        db.execute_batch("ROLLBACK").map_err(text)?;
    }
    Ok(data.dir.to_string_lossy().into_owned())
}

#[tauri::command]
fn sql_exec(data: State<Data>, sql: String) -> Answer<()> {
    data.db.lock().map_err(text)?.execute_batch(&sql).map_err(text)
}

#[tauri::command]
fn sql_run(data: State<Data>, sql: String, params: Vec<Value>) -> Answer<()> {
    let db = data.db.lock().map_err(text)?;
    let mut statement = db.prepare_cached(&sql).map_err(text)?;
    statement.execute(params_from_iter(params.iter().map(to_sql))).map(|_| ()).map_err(text)
}

#[tauri::command]
fn sql_all(data: State<Data>, sql: String, params: Vec<Value>) -> Answer<Vec<Map<String, Value>>> {
    let db = data.db.lock().map_err(text)?;
    let mut statement = db.prepare_cached(&sql).map_err(text)?;
    let names: Vec<String> = statement.column_names().iter().map(|name| name.to_string()).collect();
    let mut rows = statement.query(params_from_iter(params.iter().map(to_sql))).map_err(text)?;
    let mut all = Vec::new();
    while let Some(row) = rows.next().map_err(text)? {
        let mut record = Map::new();
        for (i, name) in names.iter().enumerate() {
            record.insert(name.clone(), to_json(row.get_ref(i).map_err(text)?));
        }
        all.push(record);
    }
    Ok(all)
}

fn blob_path(data: &Data, hash: &str) -> Answer<PathBuf> {
    if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(data.files.join(hash))
    } else {
        Err(format!("not a file hash: {hash}"))
    }
}

// the bytes come as the request's body, the hash as a header; written whole (a temporary file, renamed) or not at all
#[tauri::command]
fn blob_put(data: State<Data>, request: Request) -> Answer<()> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected the file's bytes".into());
    };
    let hash = request.headers().get("hash").and_then(|h| h.to_str().ok()).ok_or("no hash")?;
    let path = blob_path(&data, hash)?;
    if path.exists() {
        return Ok(());
    }
    let temporary = path.with_extension("tmp");
    fs::write(&temporary, bytes).map_err(text)?;
    fs::rename(&temporary, &path).map_err(text)
}

#[tauri::command]
fn blob_get(data: State<Data>, hash: String) -> Answer<Response> {
    fs::read(blob_path(&data, &hash)?).map(Response::new).map_err(text)
}

#[tauri::command]
fn blob_delete(data: State<Data>, hash: String) -> Answer<()> {
    match fs::remove_file(blob_path(&data, &hash)?) {
        Err(err) if err.kind() != std::io::ErrorKind::NotFound => Err(text(err)),
        _ => Ok(()),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            let files = dir.join("files");
            fs::create_dir_all(&files)?;
            let db = Connection::open(dir.join("research-board.db"))?;
            db.execute_batch("PRAGMA journal_mode = WAL")?;
            app.manage(Data { db: Mutex::new(db), dir, files });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![sql_open, sql_exec, sql_run, sql_all, blob_put, blob_get, blob_delete])
        .run(tauri::generate_context!())
        .expect("Research Board couldn't start");
}
