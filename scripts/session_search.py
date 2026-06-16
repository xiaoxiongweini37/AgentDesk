import sqlite3
import json
import os

DB_PATH = os.path.expanduser('~/.hermes/state.db')

def search_sessions(query, limit=5):
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
                'title': title or first_user_msg[:50] if first_user_msg else '未命名会话',
                'time': started_at,
                'messageCount': message_count,
                'preview': preview,
            })
        
        conn.close()
        return results
    except Exception as e:
        print(f'Error: {e}')
        return []

def get_session_summary(session_id):
    """获取会话摘要"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # 获取会话信息
        cursor.execute('SELECT title, started_at, message_count FROM sessions WHERE id = ?', (session_id,))
        session_row = cursor.fetchone()
        if not session_row:
            conn.close()
            return None
        
        title, started_at, message_count = session_row
        
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
        print(f'Error: {e}')
        return None

if __name__ == '__main__':
    # 测试搜索
    results = search_sessions('识别')
    print(f'找到 {len(results)} 个会话:')
    for r in results:
        print(f'  - {r["title"]} ({r["messageCount"]}条)')
