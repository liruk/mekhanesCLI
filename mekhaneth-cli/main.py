from pathlib import Path

import click
from jinja2 import Environment, FileSystemLoader
from ruamel.yaml import YAML

yaml = YAML()
yaml.indent(mapping=2, sequence=4, offset=2)
yaml.preserve_quotes = True

BASE_DIR = Path(__file__).resolve().parent.parent
SETTINGS_ROOT = BASE_DIR / "settings"


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
    return sorted(child for child in SETTINGS_ROOT.iterdir() if child.is_dir())


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


@cli.command()
def build():
    """Build characters.md and emotion matrix for each world from YAML."""
    click.echo("Starting build...")

    env = Environment(loader=FileSystemLoader(str(BASE_DIR / "templates")))
    template = env.get_template("characters.md.j2")

    for world_name, yaml_paths in iter_character_yaml_paths_by_world().items():
        characters = []
        for yaml_path in yaml_paths:
            with open(yaml_path, "r", encoding="utf-8") as f:
                characters.append(normalize_character(yaml.load(f)))

        characters.sort(key=lambda c: (c.get("reading", c["name"]), c["name"]))

        world_settings_dir = SETTINGS_ROOT / world_name / "world"
        world_settings_dir.mkdir(parents=True, exist_ok=True)

        output = template.render(characters=characters)
        output_path = world_settings_dir / "characters.md"
        output_path.write_text(output, encoding="utf-8")
        click.echo(f"Generated {output_path}")

        matrix_path = world_settings_dir / "emotion_matrix.md"
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
    """Add reading field to all character YAMLs if missing."""
    for yaml_path in iter_character_yaml_paths():
        with open(yaml_path, "r", encoding="utf-8") as f:
            data = yaml.load(f)

        if "reading" not in data:
            new_data = {}
            for key, value in data.items():
                new_data[key] = value
                if key == "name":
                    new_data["reading"] = ""

            with open(yaml_path, "w", encoding="utf-8") as f:
                yaml.dump(new_data, f)
            click.echo(f"Added reading field to {yaml_path}")


if __name__ == "__main__":
    cli()
