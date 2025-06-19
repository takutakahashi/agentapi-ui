'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { messageTemplateManager } from '../../../utils/messageTemplateManager';
import { ProfileManager } from '../../../utils/profileManager';
import { MessageTemplate, MessageTemplateInput } from '../../../types/messageTemplate';
import { Profile } from '../../../types/profile';

function TemplatesPageContent() {
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profileId');
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<MessageTemplateInput>({
    name: '',
    content: '',
  });

  const loadProfileAndTemplates = useCallback(async () => {
    if (!profileId) return;
    
    const prof = ProfileManager.getProfile(profileId);
    if (!prof) {
      router.push('/profiles');
      return;
    }
    
    setProfile(prof);
    const temps = await messageTemplateManager.getTemplatesForProfile(profileId);
    setTemplates(temps);
  }, [profileId, router]);

  useEffect(() => {
    loadProfileAndTemplates();
  }, [loadProfileAndTemplates]);

  const handleCreate = async () => {
    if (!profileId || !formData.name.trim() || !formData.content.trim()) return;

    try {
      await messageTemplateManager.createTemplate(profileId, formData);
      setFormData({ name: '', content: '' });
      setIsCreating(false);
      loadProfileAndTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const handleUpdate = async (templateId: string) => {
    if (!profileId || !formData.name.trim() || !formData.content.trim()) return;

    try {
      await messageTemplateManager.updateTemplate(profileId, templateId, formData);
      setEditingId(null);
      setFormData({ name: '', content: '' });
      loadProfileAndTemplates();
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!profileId) return;
    
    if (!confirm('このテンプレートを削除してもよろしいですか？')) return;

    try {
      await messageTemplateManager.deleteTemplate(profileId, templateId);
      loadProfileAndTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const startEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setFormData({ name: template.name, content: template.content });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', content: '' });
  };

  if (!profile) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push('/profiles')}
          className="text-blue-500 hover:text-blue-700 mb-4"
        >
          ← プロファイル一覧に戻る
        </button>
        
        <h1 className="text-2xl font-bold mb-2">メッセージテンプレート</h1>
        <p className="text-gray-600">{profile.name} のテンプレート</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          新規テンプレート作成
        </button>
      </div>

      {isCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">新規テンプレート</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">テンプレート名</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                placeholder="例: バグ修正依頼"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">テンプレート内容</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 h-32"
                placeholder="テンプレートメッセージを入力..."
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                作成
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setFormData({ name: '', content: '' });
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {templates.map((template) => (
          <div key={template.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {editingId === template.id ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">テンプレート名</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">テンプレート内容</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 h-32"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(template.id)}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                  >
                    保存
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-2">{template.name}</h3>
                <pre className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400 mb-4 bg-gray-100 dark:bg-gray-700 p-3 rounded">
                  {template.content}
                </pre>
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>更新日時: {new Date(template.updatedAt).toLocaleString('ja-JP')}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(template)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {templates.length === 0 && !isCreating && (
        <div className="text-center py-12 text-gray-500">
          <p>まだテンプレートがありません</p>
          <p className="text-sm mt-2">上のボタンから新規作成してください</p>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TemplatesPageContent />
    </Suspense>
  );
}