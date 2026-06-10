#!/usr/bin/env python3
"""会话搜索 API"""
import sqlite3
import json
import os
import sys

DB_PATH = os.path.expanduser('~/.hermes/state.db')

def search_sessions(query, limit=10):
    """搜索历史会话"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 搜索会话标题和消息内容
        cursor.execute('''
            SELECT DISTINCT s.id, s.title, s.started_at, s.message_count,
                   (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' LIMIT 1) as first_user_msg
            FROM sessions s
            LEFT JOIN messages m ON m.session_id = s.id
            WHERE s.title LIKE ? OR m.content LIKE ?
            ORDER BY s.started_at DESC
            LIMIT ?
        ''', (f'%{query}%', f'%{query}%', limit))
        
        results = []
        for row in cursor.fetchall():
            session_id, title, started_at, message_count, first_user_msg = row
            
            # 获取匹配的消息预览
            cursor.execute('''
                SELECT content FROM messages 
                WHERE session_id = ? AND content LIKE ? AND role IN ('user', 'assistant')
                LIMIT 1
            ''', (session_id, f'%{query}%'))
            
            preview_row = cursor.fetchone()
            preview = preview_row[0][:100] if preview_row else ''
            
            results.append({
                'id': session_id,
                'title': title or (first_user_msg[:50] if first_user_msg else '未命名会话'),
                'time': started_at,
                'messageCount': message_count,
                'preview': preview,
            })
        
        conn.close()
        return results
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        return []

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps([]))
        sys.exit(0)
    
    query = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    
    results = search_sessions(query, limit)
    print(json.dumps(results, ensure_ascii=False))
