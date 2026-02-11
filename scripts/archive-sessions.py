#!/usr/bin/env python3
"""
Archive Sessions Script

This script archives old sessions based on the retention policy set in settings.json.
It can be run manually or as a cron job.

Usage:
    python3 archive-sessions.py          # Use settings from settings.json
    python3 archive-sessions.py --days 30  # Override retention to 30 days
    python3 archive-sessions.py --dry-run  # Show what would be archived without doing it
"""

import argparse
import gzip
import json
import os
import shutil
import time
from pathlib import Path


# Paths
SCRIPT_DIR = Path(__file__).parent.parent
SETTINGS_FILE = SCRIPT_DIR / 'settings.json'
SESSIONS_DIR = Path.home() / '.openclaw' / 'agents' / 'main' / 'sessions'
ARCHIVE_DIR = SESSIONS_DIR / 'archive'
ARCHIVE_INDEX_FILE = ARCHIVE_DIR / 'archive-index.json'


def load_settings():
    """Load settings from settings.json."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {'retentionDays': 'never', 'autoArchive': True}


def load_archive_index():
    """Load archive index from archive-index.json."""
    if ARCHIVE_INDEX_FILE.exists():
        try:
            with open(ARCHIVE_INDEX_FILE) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {'sessions': [], 'totalSize': 0}


def save_archive_index(index):
    """Save archive index to archive-index.json."""
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    with open(ARCHIVE_INDEX_FILE, 'w') as f:
        json.dump(index, f, indent=2)


def get_file_size(file_path):
    """Get file size in bytes."""
    try:
        return file_path.stat().st_size
    except (OSError, FileNotFoundError):
        return 0


def extract_first_user_message(jsonl_path):
    """Extract the first user message from a JSONL transcript."""
    try:
        with open(jsonl_path, 'r') as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    if entry.get('type') == 'message':
                        msg = entry.get('message', {})
                        if msg.get('role') == 'user':
                            content = msg.get('content', '')
                            if isinstance(content, list):
                                text_parts = []
                                for item in content:
                                    if isinstance(item, dict) and item.get('type') == 'text':
                                        text_parts.append(item.get('text', ''))
                                    elif isinstance(item, str):
                                        text_parts.append(item)
                                content = '\n'.join(text_parts)
                            return content.strip()[:500]
                except json.JSONDecodeError:
                    continue
    except (OSError, FileNotFoundError):
        pass
    return None


def archive_session(session_key, session_data, dry_run=False):
    """Archive a single session."""
    session_id = session_data.get('sessionId', session_key)
    jsonl_file = SESSIONS_DIR / f'{session_id}.jsonl'
    
    if not jsonl_file.exists():
        # Try to find by key pattern
        matching = list(SESSIONS_DIR.glob(f'*{session_id}*.jsonl'))
        if matching:
            jsonl_file = matching[0]
        else:
            print(f"  ⚠️  No JSONL file found for {session_key}")
            return False
    
    if dry_run:
        size = get_file_size(jsonl_file)
        print(f"  📦 Would archive: {session_key} ({size / 1024:.1f} KB)")
        return True
    
    # Create archive directory
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Compress the file
    archive_file = ARCHIVE_DIR / f'{jsonl_file.stem}.jsonl.gz'
    try:
        with open(jsonl_file, 'rb') as f_in:
            with gzip.open(archive_file, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        original_size = get_file_size(jsonl_file)
        compressed_size = get_file_size(archive_file)
        compression_ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
        
        # Update archive index
        index = load_archive_index()
        index['sessions'].append({
            'key': session_key,
            'sessionId': session_id,
            'label': session_data.get('label', session_key),
            'archivedAt': int(time.time() * 1000),
            'originalSize': original_size,
            'compressedSize': compressed_size,
            'updatedAt': session_data.get('updatedAt', 0),
            'model': session_data.get('model'),
            'channel': session_data.get('channel') or session_data.get('lastChannel'),
            'task': extract_first_user_message(jsonl_file),
        })
        index['totalSize'] = sum(s.get('compressedSize', 0) for s in index['sessions'])
        save_archive_index(index)
        
        # Remove original file
        jsonl_file.unlink()
        
        # Remove from sessions.json
        sessions_file = SESSIONS_DIR / 'sessions.json'
        if sessions_file.exists():
            with open(sessions_file) as f:
                sessions = json.load(f)
            if session_key in sessions:
                del sessions[session_key]
                with open(sessions_file, 'w') as f:
                    json.dump(sessions, f, indent=2)
        
        print(f"  ✅ Archived: {session_key} ({original_size / 1024:.1f} KB → {compressed_size / 1024:.1f} KB, {compression_ratio:.0f}% reduction)")
        return True
    except Exception as e:
        print(f"  ❌ Error archiving {session_key}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description='Archive old sessions based on retention policy')
    parser.add_argument('--days', type=int, help='Override retention days (ignores settings.json)')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be archived without doing it')
    args = parser.parse_args()
    
    # Load settings
    settings = load_settings()
    
    # Determine retention days
    if args.days is not None:
        retention_days = args.days
    else:
        retention_days_str = settings.get('retentionDays', 'never')
        if retention_days_str == 'never':
            print("ℹ️  Retention policy set to 'never'. No sessions will be archived.")
            print("   Use --days to override, or change retentionDays in settings.json")
            return
        try:
            retention_days = int(retention_days_str)
        except ValueError:
            print(f"❌ Invalid retentionDays value: {retention_days_str}")
            return
    
    print(f"📋 Archive Sessions Script")
    print(f"   Retention: {retention_days} days")
    print(f"   Dry run: {'Yes' if args.dry_run else 'No'}")
    print()
    
    # Calculate cutoff timestamp
    cutoff_ms = int(time.time() * 1000) - (retention_days * 24 * 60 * 60 * 1000)
    cutoff_date = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(cutoff_ms / 1000))
    print(f"   Cutoff date: {cutoff_date}")
    print()
    
    # Load sessions
    sessions_file = SESSIONS_DIR / 'sessions.json'
    if not sessions_file.exists():
        print("❌ No sessions.json found")
        return
    
    with open(sessions_file) as f:
        sessions = json.load(f)
    
    # Find sessions to archive
    to_archive = []
    for key, session in sessions.items():
        updated_at = session.get('updatedAt', 0)
        if updated_at < cutoff_ms:
            to_archive.append((key, session))
    
    if not to_archive:
        print("✅ No sessions old enough to archive")
        return
    
    print(f"📦 Found {len(to_archive)} sessions to archive:")
    print()
    
    archived_count = 0
    for key, session in to_archive:
        if archive_session(key, session, dry_run=args.dry_run):
            archived_count += 1
    
    print()
    if args.dry_run:
        print(f"🔍 Dry run complete. {archived_count} sessions would be archived.")
    else:
        print(f"✅ Done. {archived_count} sessions archived.")


if __name__ == '__main__':
    main()
