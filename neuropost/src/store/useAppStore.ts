import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Brand,
  Post,
  Comment,
  Notification,
  SubscriptionPlan,
  PostStatus,
} from '@/types';

// ─── State shape ──────────────────────────────────────────────────────────────

interface AppState {
  // ── Brand ──────────────────────────────────────────────────────────────────
  brand:            Brand | null;
  brandLoading:     boolean;

  // ── Posts ──────────────────────────────────────────────────────────────────
  posts:            Post[];
  postsLoading:     boolean;
  selectedPostId:   string | null;

  // ── Comments ───────────────────────────────────────────────────────────────
  comments:         Comment[];
  commentsLoading:  boolean;
  unreadComments:   number;

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications:    Notification[];
  unreadNotifications: number;

  // ── UI state ───────────────────────────────────────────────────────────────
  sidebarOpen:      boolean;
  upgradeModalOpen: boolean;
  toastQueue:       { id: string; message: string; type: 'success' | 'error' | 'info' }[];

  // ── Actions: brand ─────────────────────────────────────────────────────────
  setBrand:         (brand: Brand | null) => void;
  setBrandLoading:  (loading: boolean) => void;
  updateBrand:      (patch: Partial<Brand>) => void;

  // ── Actions: posts ─────────────────────────────────────────────────────────
  setPosts:         (posts: Post[]) => void;
  setPostsLoading:  (loading: boolean) => void;
  addPost:          (post: Post) => void;
  updatePost:       (id: string, patch: Partial<Post>) => void;
  removePost:       (id: string) => void;
  setSelectedPost:  (id: string | null) => void;
  updatePostStatus: (id: string, status: PostStatus) => void;

  // ── Actions: comments ──────────────────────────────────────────────────────
  setComments:      (comments: Comment[]) => void;
  setCommentsLoading:(loading: boolean) => void;
  addComment:       (comment: Comment) => void;
  updateComment:    (id: string, patch: Partial<Comment>) => void;

  // ── Actions: notifications ─────────────────────────────────────────────────
  setNotifications: (notifications: Notification[]) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification:  (notification: Notification) => void;

  // ── Actions: UI ────────────────────────────────────────────────────────────
  setSidebarOpen:      (open: boolean) => void;
  toggleSidebar:       () => void;
  setUpgradeModalOpen: (open: boolean) => void;
  showToast:           (message: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast:        (id: string) => void;

  // ── Computed ───────────────────────────────────────────────────────────────
  pendingPosts:     () => Post[];
  canPublish:       () => boolean;
  monthlyPostCount: () => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // ── Initial state ────────────────────────────────────────────────────
      brand:               null,
      brandLoading:        false,
      posts:               [],
      postsLoading:        false,
      selectedPostId:      null,
      comments:            [],
      commentsLoading:     false,
      unreadComments:      0,
      notifications:       [],
      unreadNotifications: 0,
      sidebarOpen:         true,
      upgradeModalOpen:    false,
      toastQueue:          [],

      // ── Brand ────────────────────────────────────────────────────────────
      setBrand:        (brand) => set({ brand }),
      setBrandLoading: (brandLoading) => set({ brandLoading }),
      updateBrand:     (patch) =>
        set((s) => ({ brand: s.brand ? { ...s.brand, ...patch } : null })),

      // ── Posts ────────────────────────────────────────────────────────────
      setPosts:        (posts) => set({ posts }),
      setPostsLoading: (postsLoading) => set({ postsLoading }),

      addPost: (post) => set((s) => ({ posts: [post, ...s.posts] })),

      updatePost: (id, patch) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      removePost: (id) =>
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

      setSelectedPost: (selectedPostId) => set({ selectedPostId }),

      updatePostStatus: (id, status) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, status } : p)),
        })),

      // ── Comments ─────────────────────────────────────────────────────────
      setComments:        (comments) =>
        set({ comments, unreadComments: comments.filter((c) => c.status === 'pending').length }),

      setCommentsLoading: (commentsLoading) => set({ commentsLoading }),

      addComment: (comment) =>
        set((s) => ({
          comments:       [comment, ...s.comments],
          unreadComments: s.unreadComments + (comment.status === 'pending' ? 1 : 0),
        })),

      updateComment: (id, patch) =>
        set((s) => ({
          comments: s.comments.map((c) => (c.id === id ? { ...c, ...patch } : c)),
          unreadComments: s.comments
            .map((c) => (c.id === id ? { ...c, ...patch } : c))
            .filter((c) => c.status === 'pending').length,
        })),

      // ── Notifications ─────────────────────────────────────────────────────
      setNotifications: (notifications) =>
        set({
          notifications,
          unreadNotifications: notifications.filter((n) => !n.read).length,
        }),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
          unreadNotifications: Math.max(0, s.unreadNotifications - 1),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({
          notifications:       s.notifications.map((n) => ({ ...n, read: true })),
          unreadNotifications: 0,
        })),

      addNotification: (notification) =>
        set((s) => ({
          notifications:       [notification, ...s.notifications],
          unreadNotifications: s.unreadNotifications + (notification.read ? 0 : 1),
        })),

      // ── UI ────────────────────────────────────────────────────────────────
      setSidebarOpen:      (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar:       () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setUpgradeModalOpen: (upgradeModalOpen) => set({ upgradeModalOpen }),

      showToast: (message, type = 'info') =>
        set((s) => ({
          toastQueue: [
            ...s.toastQueue,
            { id: `toast-${Date.now()}`, message, type },
          ],
        })),

      dismissToast: (id) =>
        set((s) => ({ toastQueue: s.toastQueue.filter((t) => t.id !== id) })),

      // ── Computed ──────────────────────────────────────────────────────────
      pendingPosts: () => get().posts.filter((p) => p.status === 'pending'),

      canPublish: () => {
        const { brand, posts } = get();
        if (!brand) return false;
        if (brand.plan === 'starter') {
          const now      = new Date();
          const thisMonth = posts.filter((p) => {
            if (!p.published_at) return false;
            const d = new Date(p.published_at);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          });
          return thisMonth.length < 12;
        }
        return true;
      },

      monthlyPostCount: () => {
        const now  = new Date();
        return get().posts.filter((p) => {
          if (!p.published_at) return false;
          const d = new Date(p.published_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).length;
      },
    }),
    { name: 'NeuroPostStore' },
  ),
);

// ─── Typed selectors (convenience) ────────────────────────────────────────────

export const selectBrand         = (s: AppState) => s.brand;
export const selectPosts         = (s: AppState) => s.posts;
export const selectPendingPosts  = (s: AppState) => s.pendingPosts();
export const selectComments      = (s: AppState) => s.comments;
export const selectNotifications = (s: AppState) => s.notifications;
export const selectUnreadBadge   = (s: AppState) =>
  s.unreadComments + s.unreadNotifications;

// ─── Plan guard hook ──────────────────────────────────────────────────────────

/** Returns true if the current brand plan includes the given feature. */
export function planIncludes(plan: SubscriptionPlan | undefined, feature: 'unlimited_posts' | 'multi_platform' | 'multi_brand' | 'auto_publish'): boolean {
  switch (feature) {
    case 'unlimited_posts': return plan === 'pro' || plan === 'agency';
    case 'multi_platform':  return plan === 'pro' || plan === 'agency';
    case 'multi_brand':     return plan === 'agency';
    case 'auto_publish':    return plan === 'pro' || plan === 'agency';
    default:                return false;
  }
}
