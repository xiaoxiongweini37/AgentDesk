#!/usr/bin/env python3
"""会话摘要 API"""
import sqlite3
import json
import os
import sys

DB_PATH = os.path.expanduser('~/.hermes/state.db')

def get_session_summary(session_id):
    """获取会话摘要"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 获取会话信息
        cursor.execute('SELECT title, started_at, message_count FROM sessions WHERE id = ?', (session_id,))
        session = cursor.fetchone()
        if not session:
            conn.close()
            return None
        
        title, started_at, message_count = session
        
        # 获取用户消息
        cursor.execute('''
            SELECT content FROM messages 
            WHERE session_id = ? AND role = 'user' AND content IS NOT NULL AND content != ''
            ORDER BY timestamp
            LIMIT 10
        ''', (session_id,))
        user_messages = [row[0][:200] for row in cursor.fetchall()]
        
        # 获取 AI 回复摘要
        cursor.execute('''
            SELECT content FROM messages 
            WHERE session_id = ? AND role = 'assistant' AND content IS NOT NULL AND content != ''
            ORDER BY timestamp DESC
            LIMIT 5
        ''', (session_id,))
        assistant_messages = [row[0][:200] for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            'id': session_id,
            'title': title,
            'time': started_at,
            'messageCount': message_count,
            'userMessages': user_messages,
            'assistantMessages': assistant_messages,
        }
    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        return None

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps(None))
        sys.exit(0)
    
    session_id = sys.argv[1]
    summary = get_session_summary(session_id)
    print(json.dumps(summary, ensure_ascii=False))
