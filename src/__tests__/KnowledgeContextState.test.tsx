import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { KnowledgeProvider, useKnowledge } from '@/context/KnowledgeContext';
import { AuthContext } from '@/context/AuthContext';
import { apiClient, ApiClientError } from '@/services/api/client';
import { Collection, Tag } from '@/types';

// Mock KnowledgeService and API functions
jest.mock('@/services/api/knowledge', () => ({
  listKnowledge: jest.fn().mockResolvedValue([]),
  createKnowledgeItem: jest.fn().mockImplementation((data) =>
    Promise.resolve({ id: 'k-1', title: data.title || 'Test Note', type: data.type || 'note', tags: [], isFavorite: false, isArchived: false, ...data })
  ),
  updateKnowledgeItem: jest.fn().mockImplementation((id, data) =>
    Promise.resolve({ id, title: 'Updated Note', tags: [], ...data })
  ),
  deleteKnowledgeItem: jest.fn().mockResolvedValue(true),
  toggleKnowledgeFavorite: jest.fn().mockImplementation((id) =>
    Promise.resolve({ id, title: 'Test Note', isFavorite: true, tags: [] })
  ),
  KnowledgeService: {
    getAll: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue(null),
    searchKnowledge: jest.fn().mockResolvedValue({ items: [], page: 1, pageSize: 20, totalPages: 0, total: 0 }),
    toggleFavorite: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'k-1', title: 'Test', tags: [] }),
    update: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(true),
  },
}));

// Test consumer component
const TestConsumer = () => {
  const {
    knowledgeItems,
    collections,
    tags,
    collectionsError,
    tagsError,
    knowledgeError,
    createKnowledge,
    updateKnowledge,
    deleteKnowledge,
    toggleFavorite,
    createCollection,
    updateCollection,
    deleteCollection,
    createTag,
    updateTag,
    deleteTag,
  } = useKnowledge();

  return (
    <div>
      <div data-testid="col-count">{collections.length}</div>
      <div data-testid="tag-count">{tags.length}</div>
      <div data-testid="knowledge-count">{knowledgeItems.length}</div>
      <div data-testid="col-error">{collectionsError || 'none'}</div>
      <div data-testid="tag-error">{tagsError || 'none'}</div>
      <div data-testid="knowledge-error">{knowledgeError || 'none'}</div>
      <button
        onClick={() => createKnowledge({ title: 'My Note', type: 'NOTE', content: 'Hello', tags: [] })}
      >
        Add Note
      </button>
      <button
        onClick={() => knowledgeItems[0] && updateKnowledge(knowledgeItems[0].id, { title: 'Updated Title' })}
      >
        Update Note
      </button>
      <button
        onClick={() => knowledgeItems[0] && deleteKnowledge(knowledgeItems[0].id)}
      >
        Delete Note
      </button>
      <button
        onClick={() => knowledgeItems[0] && toggleFavorite(knowledgeItems[0].id)}
      >
        Fav Note
      </button>
      <button
        onClick={() => createCollection({ name: 'New Col', description: 'Desc', icon: 'Folder', color: '#3B82F6' })}
      >
        Add Col
      </button>
      <button
        onClick={() => collections[0] && updateCollection(collections[0].id, { name: 'Renamed Col' })}
      >
        Update Col
      </button>
      <button
        onClick={() => collections[0] && deleteCollection(collections[0].id)}
      >
        Delete Col
      </button>
      <button
        onClick={() => createTag({ name: 'new-tag', color: '#10B981' })}
      >
        Add Tag
      </button>
      <button
        onClick={() => tags[0] && updateTag(tags[0].id, { name: 'renamed-tag' })}
      >
        Update Tag
      </button>
      <button
        onClick={() => tags[0] && deleteTag(tags[0].id)}
      >
        Delete Tag
      </button>
      <ul>
        {knowledgeItems.map((k) => (
          <li key={k.id} data-testid={`knowledge-${k.id}`}>
            {k.title} - {k.isFavorite ? 'FAV' : 'NOT_FAV'}
          </li>
        ))}
      </ul>
      <ul>
        {collections.map((c) => (
          <li key={c.id} data-testid={c.id}>{c.name}</li>
        ))}
      </ul>
      <ul>
        {tags.map((t) => (
          <li key={t.id} data-testid={t.id}>{t.name}</li>
        ))}
      </ul>
    </div>
  );
};

describe('KnowledgeContext Collections and Tags state migration', () => {
  const mockCollection: Collection = {
    id: 'col-1',
    name: 'Initial Col',
    description: 'A test col',
    icon: 'Folder',
    color: '#3B82F6',
    itemCount: 2,
    createdAt: '2026-10-01T00:00:00Z',
  };

  const mockTag: Tag = {
    id: 'tag-1',
    name: 'initial-tag',
    color: '#10B981',
    itemCount: 1,
  };

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  const renderWithAuth = (isAuthenticated = true) => {
    const mockAuthContext: any = {
      isAuthenticated,
      user: { id: 'u-1', name: 'User 1', email: 'u1@test.com' },
      token: isAuthenticated ? 'fake-token' : null,
      isLoading: false,
      login: jest.fn(),
      signup: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    };

    return render(
      <AuthContext.Provider value={mockAuthContext}>
        <KnowledgeProvider>
          <TestConsumer />
        </KnowledgeProvider>
      </AuthContext.Provider>
    );
  };

  it('keeps collections and tags empty when user is unauthenticated', async () => {
    const getSpy = jest.spyOn(apiClient, 'get');

    renderWithAuth(false);

    expect(await screen.findByTestId('col-count')).toHaveTextContent('0');
    expect(screen.getByTestId('tag-count')).toHaveTextContent('0');
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('loads collections and tags from API when authenticated', async () => {
    jest.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/v1/collections') return [mockCollection];
      if (url === '/api/v1/tags') return [mockTag];
      return [];
    });

    renderWithAuth(true);

    expect(await screen.findByTestId('col-1')).toHaveTextContent('Initial Col');
    expect(screen.getByTestId('tag-1')).toHaveTextContent('initial-tag');
    expect(screen.getByTestId('col-count')).toHaveTextContent('1');
    expect(screen.getByTestId('tag-count')).toHaveTextContent('1');
  });

  it('creates a collection via API and updates React state', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue([]);
    const createdCol: Collection = {
      id: 'col-created',
      name: 'New Col',
      description: 'Desc',
      icon: 'Folder',
      color: '#3B82F6',
      itemCount: 0,
      createdAt: '2026-10-02T00:00:00Z',
    };
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(createdCol);

    renderWithAuth(true);

    await waitFor(() => expect(screen.getByTestId('col-count')).toHaveTextContent('0'));

    await act(async () => {
      screen.getByText('Add Col').click();
    });

    expect(postSpy).toHaveBeenCalledWith('/api/v1/collections', {
      name: 'New Col',
      description: 'Desc',
      icon: 'Folder',
      color: '#3B82F6',
    });
    expect(await screen.findByTestId('col-created')).toHaveTextContent('New Col');
    expect(screen.getByTestId('col-count')).toHaveTextContent('1');
  });

  it('updates a collection via API and updates React state', async () => {
    jest.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/v1/collections') return [mockCollection];
      return [];
    });
    const updatedCol: Collection = { ...mockCollection, name: 'Renamed Col' };
    const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(updatedCol);

    renderWithAuth(true);

    await waitFor(() => expect(screen.getByTestId('col-1')).toHaveTextContent('Initial Col'));

    await act(async () => {
      screen.getByText('Update Col').click();
    });

    expect(patchSpy).toHaveBeenCalledWith('/api/v1/collections/col-1', { name: 'Renamed Col' });
    expect(await screen.findByTestId('col-1')).toHaveTextContent('Renamed Col');
  });

  it('deletes a collection via API and updates React state', async () => {
    jest.spyOn(apiClient, 'get').mockImplementation(async (url: string) => {
      if (url === '/api/v1/collections') return [mockCollection];
      return [];
    });
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);

    renderWithAuth(true);

    await waitFor(() => expect(screen.getByTestId('col-1')).toBeInTheDocument());

    await act(async () => {
      screen.getByText('Delete Col').click();
    });

    expect(deleteSpy).toHaveBeenCalledWith('/api/v1/collections/col-1');
    expect(screen.queryByTestId('col-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('col-count')).toHaveTextContent('0');
  });

  it('creates, updates, and deletes tags via API and updates React state', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue([]);

    const createdTag: Tag = { id: 'tag-new', name: 'new-tag', color: '#10B981', itemCount: 0 };
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(createdTag);

    renderWithAuth(true);

    await waitFor(() => expect(screen.getByTestId('tag-count')).toHaveTextContent('0'));

    // Create Tag
    await act(async () => {
      screen.getByText('Add Tag').click();
    });

    expect(postSpy).toHaveBeenCalledWith('/api/v1/tags', { name: 'new-tag', color: '#10B981' });
    expect(await screen.findByTestId('tag-new')).toHaveTextContent('new-tag');

    // Update Tag
    const updatedTag: Tag = { ...createdTag, name: 'renamed-tag' };
    const patchSpy = jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(updatedTag);

    await act(async () => {
      screen.getByText('Update Tag').click();
    });

    expect(patchSpy).toHaveBeenCalledWith('/api/v1/tags/tag-new', { name: 'renamed-tag' });
    expect(await screen.findByTestId('tag-new')).toHaveTextContent('renamed-tag');

    // Delete Tag
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(null);

    await act(async () => {
      screen.getByText('Delete Tag').click();
    });

    expect(deleteSpy).toHaveBeenCalledWith('/api/v1/tags/tag-new');
    expect(screen.queryByTestId('tag-new')).not.toBeInTheDocument();
  });

  it('handles API failure by displaying error without falling back to LocalStorage', async () => {
    jest.spyOn(apiClient, 'get').mockRejectedValue(
      new ApiClientError('Server Error 500', 500)
    );

    renderWithAuth(true);

    await waitFor(() => {
      expect(screen.getByTestId('col-error')).toHaveTextContent('Server Error 500');
    });
    expect(screen.getByTestId('col-count')).toHaveTextContent('0');
  });

  it('creates, updates, toggles favorite, and deletes knowledge items via API', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue([]);

    renderWithAuth(true);

    await waitFor(() => expect(screen.getByTestId('knowledge-count')).toHaveTextContent('0'));

    // Create Note
    await act(async () => {
      screen.getByText('Add Note').click();
    });

    expect(await screen.findByTestId('knowledge-k-1')).toHaveTextContent('My Note - NOT_FAV');
    expect(screen.getByTestId('knowledge-count')).toHaveTextContent('1');

    // Update Note
    await act(async () => {
      screen.getByText('Update Note').click();
    });

    expect(await screen.findByTestId('knowledge-k-1')).toHaveTextContent('Updated Title - NOT_FAV');

    // Toggle Favorite
    await act(async () => {
      screen.getByText('Fav Note').click();
    });

    expect(await screen.findByTestId('knowledge-k-1')).toHaveTextContent('Test Note - FAV');

    // Delete Note
    await act(async () => {
      screen.getByText('Delete Note').click();
    });

    expect(screen.queryByTestId('knowledge-k-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('knowledge-count')).toHaveTextContent('0');
  });
});
