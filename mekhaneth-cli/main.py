import sys
import os
import csv
import pandas as pd
from ruamel.yaml import YAML
import click
from pathlib import Path
import re
from jinja2 import Environment, FileSystemLoader

yaml = YAML()
yaml.indent(mapping=2, sequence=4, offset=2)
yaml.preserve_quotes = True

BASE_DIR = Path(__file__).resolve().parent.parent
SETTINGS_ROOT = BASE_DIR / "settings"
DEFAULT_WORLD_DIR = SETTINGS_ROOT / "mekhanes"
DEFAULT_BASE_SETTINGS_DIR = DEFAULT_WORLD_DIR / "world"

@click.group()
def cli():
    """Mekhaneth Character Data Management Tool"""
    pass

def iter_character_yaml_paths():
    """Collect character profile YAML files from each world directory under settings/."""
    if not SETTINGS_ROOT.exists():
        return []

    yaml_paths = []
    for child in SETTINGS_ROOT.iterdir():
        if not child.is_dir():
            continue
        yaml_paths.extend(path for path in child.rglob("profile.yaml") if path.is_file())
    return sorted(yaml_paths)

def iter_world_dirs():
    if not SETTINGS_ROOT.exists():
        return []
    return sorted(
        child for child in SETTINGS_ROOT.iterdir()
        if child.is_dir()
    )

def iter_character_yaml_paths_by_world():
    world_map = {}
    for world_dir in iter_world_dirs():
        world_map[world_dir.name] = sorted(
            path for path in world_dir.rglob("profile.yaml") if path.is_file()
        )
    return world_map

def normalize_markdown_value(value):
    if isinstance(value, list):
        lines = []
        for item in value:
            rendered = normalize_markdown_value(item)
            if "\n" in rendered:
                lines.append("- " + rendered.replace("\n", "\n  "))
            else:
                lines.append(f"- {rendered}")
        return "\n".join(lines)
    if isinstance(value, dict):
        lines = []
        for key, item in value.items():
            rendered = normalize_markdown_value(item)
            if "\n" in rendered:
                lines.append(f"- {key}:")
                lines.extend(f"  {line}" for line in rendered.splitlines())
            else:
                lines.append(f"- {key}: {rendered}")
        return "\n".join(lines)
    if value is None:
        return ""
    return str(value)

def normalize_character(data):
    if not isinstance(data, dict):
        return data

    normalized = dict(data)
    normalized["background"] = normalize_markdown_value(normalized.get("background", ""))
    profile = dict(normalized.get("profile", {}))
    for key in ("appearance", "personality"):
        profile[key] = normalize_markdown_value(profile.get(key, ""))
    normalized["profile"] = profile
    normalized["relations"] = [
        {**relation, "content": normalize_markdown_value(relation.get("content", ""))}
        for relation in normalized.get("relations", [])
        if isinstance(relation, dict)
    ]
    return normalized

def parse_characters_md():
    md_path = DEFAULT_BASE_SETTINGS_DIR / "characters.md"
    if not md_path.exists():
        return {}
    
    content = md_path.read_text(encoding="utf-8")
    sections = re.split(r'\n## ', content)
    
    characters = {}
    for section in sections:
        if section.startswith("# "):
            continue
            
        lines = section.strip().split('\n')
        header = lines[0]
        # Match "Name (Alias)" or just "Name"
        match = re.match(r'(.+?)\s*(?:\((.+?)\))?$', header)
        if match:
            name = match.group(1).strip()
            alias = match.group(2).strip() if match.group(2) else ""
            
            char_data = {
                "name": name,
                "alias": alias,
                "sections": {}
            }
            
            current_key = None
            current_content = []
            
            for line in lines[1:]:
                if line.startswith("- **"):
                    if current_key:
                        char_data["sections"][current_key] = "\n".join(current_content).strip()
                    
                    key_match = re.match(r'- \*\*(.+?)\*\*:?\s*(.*)', line)
                    if key_match:
                        current_key = key_match.group(1).strip()
                        current_content = [key_match.group(2).strip()]
                elif line.startswith("    - "):
                    current_content.append(line.strip())
                else:
                    current_content.append(line)
            
            if current_key:
                char_data["sections"][current_key] = "\n".join(current_content).strip()
                
            characters[name] = char_data
            
    return characters

def parse_csv_tables():
    csv_dir = BASE_DIR / "examples"
    data = {}
    
    # Emotion Matrix
    emotion_csv = csv_dir / "いろいろな表 - 感情表(登場当時).csv"
    if emotion_csv.exists():
        df = pd.read_csv(emotion_csv)
        # First column is character name
        target_chars = df.columns[2:] # From '小凪葉らん' onwards
        source_chars = df.iloc[:, 0]
        
        matrix = {}
        for i, row in df.iterrows():
            source = row[0]
            if pd.isna(source): continue
            matrix[source] = {}
            for target in target_chars:
                if target in row:
                    matrix[source][target] = row[target]
        data["emotions"] = matrix

    # Age Table
    age_csv = csv_dir / "いろいろな表 - 年齢.csv"
    if age_csv.exists():
        df = pd.read_csv(age_csv)
        ages = {}
        # row 0 is header (already in df.columns)
        # row 1 is ages
        # row 2 is details (委細)
        char_names = df.columns[1:]
        age_values = df.iloc[0, 1:]
        age_details = df.iloc[1, 1:]
        
        for name in char_names:
            ages[name] = {
                "value": str(age_values[name]),
                "detail": str(age_details[name])
            }
        data["ages"] = ages

    # Alcohol Table
    alcohol_csv = csv_dir / "いろいろな表 - 酒の強さ.csv"
    if alcohol_csv.exists():
        df = pd.read_csv(alcohol_csv)
        alcohol = {}
        char_names = df.columns[1:]
        values = df.iloc[0, 1:]
        details = df.iloc[1, 1:]
        for name in char_names:
            alcohol[name] = {
                "value": str(values[name]),
                "detail": str(details[name])
            }
        data["alcohol"] = alcohol

    # Sex/Gender Table
    sex_csv = csv_dir / "いろいろな表 - 性について.csv"
    if sex_csv.exists():
        df = pd.read_csv(sex_csv)
        sex_data = {}
        char_names = df.columns[1:]
        # Rows: 肉体, 自認, 対象, 委細
        for name in char_names:
            sex_data[name] = {
                "body": str(df.iloc[0, df.columns.get_loc(name)]),
                "identity": str(df.iloc[1, df.columns.get_loc(name)]),
                "target": str(df.iloc[2, df.columns.get_loc(name)]),
                "detail": str(df.iloc[3, df.columns.get_loc(name)])
            }
        data["sex"] = sex_data

    return data

@cli.command()
def migrate():
    """Migrate characters.md and CSVs to YAML"""
    click.echo("WARNING: This command is DEPRECATED and should not be used. It will overwrite existing YAML files.")
    return
    
    md_chars = parse_characters_md()
    csv_data = parse_csv_tables()
    
    # Normalize character names across sources
    # We'll use the names in md_chars as the primary list
    all_names = set(md_chars.keys())
    # Add names from CSVs that might not be in the MD
    for category in ["emotions", "ages", "alcohol", "sex"]:
        all_names.update(csv_data.get(category, {}).keys())
    
    # Mapping for name normalization (e.g., Handling full names vs first names)
    name_map = {}
    for name in all_names:
        # Simple heuristic: if a short name is a prefix of a long name, map them
        # In this specific project, names like "スキップ博士" and "スキップ・センサード博士" exist.
        # "九十九堂" and "九十九堂冷泉分胤" exist.
        if "スキップ" in name:
            name_map[name] = "スキップ・センサード博士"
        elif "九十九堂" in name:
            name_map[name] = "九十九堂冷泉分胤"
        elif "いおど" in name.lower():
            name_map[name] = "黑入鹿イオド"
        else:
            name_map[name] = name

    # Group data by normalized name
    normalized_data = {}
    for name in all_names:
        norm_name = name_map[name]
        if norm_name not in normalized_data:
            normalized_data[norm_name] = {
                "name": norm_name,
                "aliases": set(),
                "profile": {},
                "status": {},
                "background": "",
                "relations": {},
                "raw_sections": {}
            }
        
        target = normalized_data[norm_name]
        
        # Add alias
        if name != norm_name:
            target["aliases"].add(name)
        
        # Merge MD data
        if name in md_chars:
            md_entry = md_chars[name]
            if md_entry["alias"]: target["aliases"].add(md_entry["alias"])
            
            sections = md_entry["sections"]
            for k, v in sections.items():
                if k == "外見": target["profile"]["appearance"] = v
                elif k == "性格": target["profile"]["personality"] = v
                elif k == "背景": target["background"] = v
                elif k == "関係性":
                    # Relationships in MD are often bullet points, we might want to split them
                    # But for now, we'll keep them in a special field if they collide
                    target["raw_sections"]["MD_Relations"] = v
                else:
                    target["raw_sections"][k] = v

        # Merge CSV data
        if name in csv_data.get("ages", {}):
            target["profile"]["age"] = csv_data["ages"][name]["value"]
            target["profile"]["age_detail"] = csv_data["ages"][name]["detail"]
            
        if name in csv_data.get("sex", {}):
            target["profile"]["sex"] = {
                "body": csv_data["sex"][name]["body"],
                "identity": csv_data["sex"][name]["identity"],
                "target": csv_data["sex"][name]["target"],
                "detail": csv_data["sex"][name]["detail"]
            }
            
        if name in csv_data.get("alcohol", {}):
            target["status"]["alcohol"] = {
                "value": csv_data["alcohol"][name]["value"],
                "detail": csv_data["alcohol"][name]["detail"]
            }
            
        # Relations from Emotion Matrix
        emotions = csv_data.get("emotions", {}).get(name, {})
        for relation_target, content in emotions.items():
            if pd.notna(content):
                # Normalize target name too
                norm_target = name_map.get(relation_target, relation_target)
                target["relations"][norm_target] = content

    for norm_name, data in normalized_data.items():
        # Cleanup character ID for filename
        char_id = norm_name.replace(" ", "_").lower()
        # Remove chars that might be problematic in filenames
        char_id = re.sub(r'[^\w\-_]', '', char_id)
        
        yaml_path = DEFAULT_WORLD_DIR / char_id / "profile.yaml"
        yaml_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Final formatting
        output = {
            "name": data["name"],
            "aliases": list(data["aliases"]),
            "profile": data["profile"],
            "status": data["status"],
            "background": data["background"],
            "relations": [{"target": k, "content": v} for k, v in data["relations"].items()],
        }
        if data["raw_sections"]:
            output["misc"] = data["raw_sections"]
        
        # Remove empty keys
        output = {k: v for k, v in output.items() if v}
        
        with open(yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(output, f)
            
        click.echo(f"Generated {yaml_path}")

    click.echo("Migration complete.")

@cli.command()
def build():
    """Build characters.md and emotion matrix for each world from YAML"""
    click.echo("Starting build...")
    
    env = Environment(loader=FileSystemLoader(str(BASE_DIR / "templates")))
    template = env.get_template("characters.md.j2")

    for world_name, yaml_paths in iter_character_yaml_paths_by_world().items():
        characters = []
        for yaml_path in yaml_paths:
            with open(yaml_path, "r", encoding="utf-8") as f:
                characters.append(normalize_character(yaml.load(f)))

        characters.sort(key=lambda c: (c.get("reading", c["name"]), c["name"]))

        world_base_settings_dir = SETTINGS_ROOT / world_name / "world"
        world_base_settings_dir.mkdir(parents=True, exist_ok=True)

        output = template.render(characters=characters)
        output_path = world_base_settings_dir / "characters.md"
        output_path.write_text(output, encoding="utf-8")
        click.echo(f"Generated {output_path}")

        matrix_path = world_base_settings_dir / "emotion_matrix.md"
        all_names = [c["name"] for c in characters]

        matrix_lines = []
        header_line = "| → | " + " | ".join(all_names) + " |"
        sep_line = "| --- | " + " | ".join(["---"] * len(all_names)) + " |"
        matrix_lines.append(header_line)
        matrix_lines.append(sep_line)

        for char in characters:
            row = [f"**{char['name']}**"]
            relations = {r["target"]: r["content"] for r in char.get("relations", [])}
            for name in all_names:
                content = relations.get(name, "-")
                content = content.replace("\n", "<br>")
                row.append(content)
            matrix_lines.append("| " + " | ".join(row) + " |")

        matrix_path.write_text("\n".join(matrix_lines), encoding="utf-8")
        click.echo(f"Generated {matrix_path}")

    click.echo("Build complete.")

@cli.command()
def add_reading():
    """Add reading field to all character YAMLs if missing"""
    for yaml_path in iter_character_yaml_paths():
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.load(f)
        
        if "reading" not in data:
            # Insert reading field after name
            new_data = {}
            for k, v in data.items():
                new_data[k] = v
                if k == "name":
                    new_data["reading"] = ""
            
            with open(yaml_path, "w", encoding="utf-8") as f:
                yaml.dump(new_data, f)
            click.echo(f"Added reading field to {yaml_path.name}")

if __name__ == "__main__":
    cli()
