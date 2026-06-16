import React, { useState, useEffect } from 'react';
import {
  Platform,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  View,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  LogOut, 
  AlertCircle 
} from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Interfaces
interface Post {
  id: string;
  username: string;
  avatar: string;
  location: string;
  imageUrl: string;
  likes: number;
  isLiked: boolean;
  caption: string;
  time: string;
  comments: { username: string; text: string; id: string; isLiked?: boolean }[];
}

// Reusable Expandable Text Component for Caption and Comments
function ExpandableText({ text, boldPrefix, maxChars = 90 }: { text: string; boldPrefix?: string; maxChars?: number }) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();

  const isLong = text.length > maxChars;
  const displayText = expanded || !isLong ? text : `${text.slice(0, maxChars)}...`;

  return (
    <ThemedText style={{ fontSize: 14, lineHeight: 18 }}>
      {boldPrefix && <ThemedText type="smallBold" style={{ marginRight: 4 }}>{boldPrefix} </ThemedText>}
      {displayText}
      {isLong && !expanded && (
        <ThemedText
          onPress={() => setExpanded(true)}
          style={{ color: theme.textSecondary, fontWeight: '600', marginLeft: 4, cursor: 'pointer' } as any}
        >
          see more
        </ThemedText>
      )}
    </ThemedText>
  );
}

export default function HomeScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const theme = useTheme();
  
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + Spacing.three,
  };

  // Auth States
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Posts Feed & Pagination States
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Interactions
  const [newCommentTexts, setNewCommentTexts] = useState<{ [key: string]: string }>({});
  const [toastMessage, setToastMessage] = useState('');

  const isWeb = Platform.OS === 'web';

  // Check persisted credentials on mount
  useEffect(() => {
    if (isWeb) {
      const savedAuth = localStorage.getItem('user_auth');
      if (savedAuth) {
        try {
          const parsed = JSON.parse(savedAuth);
          setName(parsed.name || '');
          setEmail(parsed.email || '');
          setIsLoggedIn(true);
        } catch (e) {
          console.error('Failed to parse persisted credentials:', e);
        }
      }
    }
    setCheckingAuth(false);
  }, []);

  // Fetch 10 posts at a time from keyless Picsum Photos and comments from JSONPlaceholder
  const fetchPosts = async (pageNum: number, isInitial = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      let fetchedPhotos: any[] = [];

      // 1. Fetch comments batch from JSONPlaceholder (30 comments per page to give 3 comments per post)
      const commentsResponse = await fetch(
        `https://jsonplaceholder.typicode.com/comments?_page=${pageNum}&_limit=30`
      );
      const commentsData = await commentsResponse.json();

      // 2. Fetch photos from free Picsum API
      const response = await fetch(`https://picsum.photos/v2/list?page=${pageNum}&limit=10`);
      const data = await response.json();
      if (Array.isArray(data)) {
        fetchedPhotos = data;
      }

      // 3. Combine photos and comments
      const formattedPosts: Post[] = fetchedPhotos.map((photo: any, index: number) => {
        const startIndex = index * 3;
        const postComments = (Array.isArray(commentsData) ? commentsData : [])
          .slice(startIndex, startIndex + 3)
          .map((c: any) => ({
            id: c.id.toString(),
            username: c.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, ''),
            text: c.body.replace(/\n/g, ' '),
            isLiked: false,
          }));

        return {
          id: photo.id,
          username: photo.author.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          avatar: `https://picsum.photos/id/${photo.id}/150/150`,
          location: 'Curated Photo',
          imageUrl: `https://picsum.photos/id/${photo.id}/800/800`,
          likes: Math.floor(Math.random() * 300) + 5,
          isLiked: false,
          caption: `Captured by ${photo.author}. A beautiful perspective showcasing the depth of modern photography, standard framing, and exquisite scenery.`,
          time: 'Recently',
          comments: postComments,
        };
      });

      if (isInitial) {
        setPosts(formattedPosts);
      } else {
        // Append and cache posts
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewPosts = formattedPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewPosts];
        });
      }
    } catch (error) {
      console.error('Error loading posts or comments:', error);
      showToast('Failed to fetch posts/comments.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch initial posts on login
  useEffect(() => {
    if (isLoggedIn) {
      fetchPosts(1, true);
    }
  }, [isLoggedIn]);

  // Auth Handler
  const handleAuthSubmit = () => {
    setAuthError('');
    if (!email.trim() || !password.trim()) {
      setAuthError('Please fill in all credentials.');
      return;
    }
    const displayName = authMode === 'signup' && name ? name : email.split('@')[0];
    if (isWeb) {
      localStorage.setItem('user_auth', JSON.stringify({ name: displayName, email }));
    }
    setName(displayName);
    setIsLoggedIn(true);
  };

  // Logout Handler
  const handleLogout = () => {
    if (isWeb) {
      localStorage.removeItem('user_auth');
    }
    setIsLoggedIn(false);
    setName('');
    setEmail('');
    setPassword('');
    setAuthError('');
  };

  // Load More Posts
  const handleLoadMore = () => {
    if (loading || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, false);
  };

  // Like Toggle
  const handleLike = (postId: string) => {
    setPosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: !post.isLiked,
            likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          };
        }
        return post;
      })
    );
  };

  // Like Comment Toggle
  const handleLikeComment = (postId: string, commentId: string) => {
    setPosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map(c =>
              c.id === commentId ? { ...c, isLiked: !c.isLiked } : c
            ),
          };
        }
        return post;
      })
    );
  };

  // Add Comment
  const handleAddComment = (postId: string) => {
    const text = newCommentTexts[postId];
    if (!text || !text.trim()) return;

    setPosts(prev =>
      prev.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            comments: [
              ...post.comments,
              {
                id: Date.now().toString(),
                username: name || 'visitor',
                text: text.trim(),
                isLiked: false,
              },
            ],
          };
        }
        return post;
      })
    );
    setNewCommentTexts(prev => ({ ...prev, [postId]: '' }));
  };

  // Share Simulation
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleShare = (post: Post) => {
    const shareUrl = `https://picsum.photos/id/${post.id}/800/800`;
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(shareUrl);
      showToast('Post link copied to clipboard!');
    } else {
      showToast(`Sharing post by @${post.username}`);
    }
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: 0,
      paddingBottom: Spacing.four,
    },
  });

  if (checkingAuth) {
    return (
      <View style={[styles.centerLoader, { backgroundColor: theme.background, height: '100vh' }]}>
        <ActivityIndicator size="large" color="#0095f6" />
      </View>
    );
  }

  // Render Login & Signup Form
  if (!isLoggedIn) {
    return (
      <View style={[styles.loginContainer, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.loginScrollContent}>
          <View style={[styles.loginCard, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
            
            {/* TheApp task Brand Logo */}
            <ThemedText style={styles.loginBrandLogo}>TheApp task</ThemedText>

            {authError ? (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#EF4444" style={{ marginRight: 6 }} />
                <ThemedText style={styles.errorText}>{authError}</ThemedText>
              </View>
            ) : null}

            {authMode === 'signup' && (
              <TextInput
                style={[styles.loginInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
                placeholder="Full Name"
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
              />
            )}

            <TextInput
              style={[styles.loginInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
              placeholder="Username or Email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              style={[styles.loginInput, { color: theme.text, borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />

            <Pressable onPress={handleAuthSubmit} style={styles.loginBtn}>
              <ThemedText style={styles.loginBtnText}>
                {authMode === 'login' ? 'Log in' : 'Sign up'}
              </ThemedText>
            </Pressable>

            {/* Quick Demo Bypass */}
            <Pressable
              onPress={() => {
                const bypassName = 'visitor_user';
                const bypassEmail = 'visitor@example.com';
                if (isWeb) {
                  localStorage.setItem('user_auth', JSON.stringify({ name: bypassName, email: bypassEmail }));
                }
                setName(bypassName);
                setEmail(bypassEmail);
                setIsLoggedIn(true);
              }}
              style={styles.bypassBtn}
            >
              <ThemedText style={styles.bypassBtnText}>
                Bypass login to view app
              </ThemedText>
            </Pressable>
          </View>

          {/* Toggle Panel */}
          <View style={[styles.loginToggleCard, { borderColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
            <ThemedText style={{ fontSize: 14 }}>
              {authMode === 'login' ? "Don't have an account? " : 'Have an account? '}
              <ThemedText
                onPress={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthError('');
                }}
                style={styles.toggleLink}
              >
                {authMode === 'login' ? 'Sign up' : 'Log in'}
              </ThemedText>
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.appWrapper, { backgroundColor: theme.background }]}>
      
      {/* Toast Notification */}
      {toastMessage ? (
        <View style={styles.toastContainer}>
          <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
        </View>
      ) : null}

      {/* Top Header */}
      <View style={[styles.topHeader, { borderBottomColor: theme.backgroundSelected, backgroundColor: theme.background }]}>
        <View style={styles.topHeaderInner}>
          <ThemedText style={styles.instaTitle}>TheApp task</ThemedText>
          <View style={styles.topHeaderIcons}>
            <Pressable style={styles.headerIcon} onPress={handleLogout}>
              <LogOut size={22} color={theme.text} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Main Content Areas */}
      <ScrollView
        style={[styles.mainContent, { backgroundColor: theme.background }]}
        contentContainerStyle={contentPlatformStyle}
      >
        <View style={styles.contentInnerContainer}>
          {/* Post Feed */}
          {loading ? (
            <View style={styles.centerLoader}>
              <ActivityIndicator size="large" color="#0095f6" />
              <ThemedText style={{ marginTop: 10 }} themeColor="textSecondary">Loading posts...</ThemedText>
            </View>
          ) : (
            <View style={styles.feedContainer}>
              {posts.map(post => (
                <View key={post.id} style={[styles.postCard, { borderBottomColor: theme.backgroundSelected }]}>
                  {/* Post Header */}
                  <View style={styles.postHeader}>
                    <Image source={{ uri: post.avatar }} style={styles.postAvatar} />
                    <View>
                      <ThemedText type="smallBold">{post.username}</ThemedText>
                      {post.location ? (
                        <ThemedText style={styles.postLocation} themeColor="textSecondary">
                          {post.location}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>

                  {/* Post Image */}
                  <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />

                  {/* Action Bar */}
                  <View style={styles.postActions}>
                    <View style={styles.actionLeft}>
                      <Pressable onPress={() => handleLike(post.id)}>
                        {post.isLiked ? (
                          <Heart size={24} color="#EF4444" fill="#EF4444" style={{ marginRight: Spacing.three }} />
                        ) : (
                          <Heart size={24} color={theme.text} style={{ marginRight: Spacing.three }} />
                        )}
                      </Pressable>
                      <Pressable onPress={() => showToast('Write your comment in the text input below')}>
                        <MessageCircle size={24} color={theme.text} style={{ marginRight: Spacing.three }} />
                      </Pressable>
                      <Pressable onPress={() => handleShare(post)}>
                        <Send size={24} color={theme.text} />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => showToast('Post bookmarked!')}>
                      <Bookmark size={24} color={theme.text} />
                    </Pressable>
                  </View>

                  {/* Likes & Caption */}
                  <View style={styles.postDetails}>
                    <ThemedText type="smallBold" style={{ marginBottom: 4 }}>
                      {post.likes.toLocaleString()} likes
                    </ThemedText>
                    <ExpandableText boldPrefix={post.username} text={post.caption} maxChars={80} />
                    
                    {/* Comments List (Instagram Layout style) */}
                    {post.comments.length > 0 && (
                      <View style={styles.commentsList}>
                        {post.comments.map((comment) => (
                          <View key={comment.id} style={styles.commentRow}>
                            <Image
                              source={{ uri: `https://picsum.photos/id/${(parseInt(post.id) + parseInt(comment.id || '1')) % 100}/100/100` }}
                              style={styles.commentAvatar}
                            />
                            <View style={styles.commentTextContainer}>
                              <ExpandableText boldPrefix={comment.username} text={comment.text} maxChars={70} />
                              <View style={styles.commentSubActions}>
                                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, marginRight: 14 }}>1d</ThemedText>
                                <Pressable onPress={() => showToast('Reply feature coming soon')}>
                                  <ThemedText type="smallBold" style={{ fontSize: 11, color: theme.textSecondary }}>Reply</ThemedText>
                                </Pressable>
                              </View>
                            </View>
                            <Pressable onPress={() => handleLikeComment(post.id, comment.id)} style={styles.commentLikeBtn}>
                              {comment.isLiked ? (
                                <Heart size={14} color="#EF4444" fill="#EF4444" />
                              ) : (
                                <Heart size={14} color={theme.textSecondary} />
                              )}
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    <ThemedText style={styles.postTime} themeColor="textSecondary">
                      {post.time}
                    </ThemedText>
                  </View>

                  {/* Add Comment Row */}
                  <View style={[styles.commentInputRow, { borderTopColor: theme.backgroundSelected }]}>
                    <TextInput
                      placeholder="Add a comment..."
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.commentInput, { color: theme.text }]}
                      value={newCommentTexts[post.id] || ''}
                      onChangeText={txt => setNewCommentTexts(prev => ({ ...prev, [post.id]: txt }))}
                    />
                    <Pressable onPress={() => handleAddComment(post.id)}>
                      <ThemedText style={styles.postCommentBtn}>Post</ThemedText>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Load More Trigger */}
          {!loading && (
            <View style={styles.loadMoreContainer}>
              {loadingMore ? (
                <ActivityIndicator size="small" color="#0095f6" />
              ) : (
                <Pressable onPress={handleLoadMore} style={[styles.loadMoreBtn, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">Load More Posts</ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {Platform.OS === 'web' && <WebBadge />}
    </View>
  );
}

const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    zIndex: 999,
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  topHeader: {
    height: 56,
    width: '100%',
    justifyContent: 'center',
    borderBottomWidth: 1,
    position: Platform.OS === 'web' ? 'fixed' : 'relative',
    top: 0,
    zIndex: 100,
  },
  topHeaderInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  instaTitle: {
    fontFamily: 'serif',
    fontSize: 24,
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  topHeaderIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: Spacing.one,
  },
  mainContent: {
    flex: 1,
    marginTop: Platform.OS === 'web' ? 56 : 0,
  },
  contentInnerContainer: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  centerLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.six,
  },
  feedContainer: {
    width: '100%',
  },
  postCard: {
    borderBottomWidth: 1,
    paddingBottom: Spacing.three,
    marginBottom: Spacing.three,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  postLocation: {
    fontSize: 11,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postDetails: {
    paddingHorizontal: Spacing.three,
  },
  commentsList: {
    marginTop: Spacing.three,
    gap: Spacing.two,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginTop: 2,
  },
  commentTextContainer: {
    flex: 1,
  },
  commentSubActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  commentLikeBtn: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  postTime: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    paddingTop: Spacing.two,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  commentInput: {
    flex: 1,
    height: 36,
    fontSize: 14,
  },
  postCommentBtn: {
    color: '#0095f6',
    fontWeight: 'bold',
    fontSize: 14,
  },
  loadMoreContainer: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtn: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: 20,
    alignItems: 'center',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100%',
  },
  loginScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.five,
  },
  loginCard: {
    width: 350,
    borderWidth: 1,
    padding: 40,
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: Spacing.three,
  },
  loginBrandLogo: {
    fontFamily: 'serif',
    fontSize: 40,
    fontWeight: 'bold',
    fontStyle: 'italic',
    marginBottom: Spacing.five,
  },
  loginInput: {
    width: '100%',
    height: 38,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: Spacing.two,
    fontSize: 12,
    marginBottom: Spacing.two,
  },
  loginBtn: {
    width: '100%',
    height: 32,
    backgroundColor: '#0095f6',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  bypassBtn: {
    marginTop: Spacing.three,
  },
  bypassBtnText: {
    color: '#0095f6',
    fontSize: 12,
  },
  loginToggleCard: {
    width: 350,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    borderRadius: 4,
  },
  toggleLink: {
    color: '#0095f6',
    fontWeight: 'bold',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 4,
    padding: Spacing.two,
    width: '100%',
    marginBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
});
