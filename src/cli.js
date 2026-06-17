import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import clipboardy from 'clipboardy';

const AUTH_FILE = path.join(process.cwd(), '.user_auth.json');

// Global State
let currentUser = null; // { name, email }
let posts = [];
let page = 1;
let loading = false;
let bookmarkedPosts = new Set();

// Utility: Read Auth from file
async function loadAuth() {
  try {
    const data = await fs.readFile(AUTH_FILE, 'utf-8');
    currentUser = JSON.parse(data);
    return true;
  } catch (error) {
    return false;
  }
}

// Utility: Save Auth to file
async function saveAuth(name, email) {
  currentUser = { name, email };
  await fs.writeFile(AUTH_FILE, JSON.stringify(currentUser, null, 2), 'utf-8');
}

// Utility: Remove Auth file
async function clearAuth() {
  currentUser = null;
  try {
    await fs.unlink(AUTH_FILE);
  } catch (error) {
    // Ignore error if file doesn't exist
  }
}

// Fetch Posts & Comments
async function fetchPosts(pageNum, isInitial = false) {
  const spinner = ora(chalk.blue('Fetching posts and comments...')).start();
  try {
    // 1. Fetch comments batch from JSONPlaceholder (30 comments per page to give 3 comments per post)
    const commentsResponse = await fetch(
      `https://jsonplaceholder.typicode.com/comments?_page=${pageNum}&_limit=30`
    );
    const commentsData = await commentsResponse.json();

    // 2. Fetch photos from free Picsum API
    const response = await fetch(`https://picsum.photos/v2/list?page=${pageNum}&limit=10`);
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid posts data received');
    }

    // 3. Combine photos and comments
    const formattedPosts = data.map((photo, index) => {
      const startIndex = index * 3;
      const postComments = (Array.isArray(commentsData) ? commentsData : [])
        .slice(startIndex, startIndex + 3)
        .map((c) => ({
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
      posts = formattedPosts;
    } else {
      const existingIds = new Set(posts.map((p) => p.id));
      const uniqueNewPosts = formattedPosts.filter((p) => !existingIds.has(p.id));
      posts = [...posts, ...uniqueNewPosts];
    }
    
    spinner.succeed(chalk.green(`Successfully loaded page ${pageNum}!`));
  } catch (error) {
    spinner.fail(chalk.red('Failed to fetch posts or comments: ' + error.message));
  }
}

// Show Title Bar
function printHeader() {
  console.clear();
  console.log(chalk.bold.gradient ? chalk.bold.cyan('*** TheApp task - CLI Edition ***') : chalk.bold.cyan('*** TheApp task - CLI Edition ***'));
  if (currentUser) {
    console.log(chalk.green(`Logged in as: ${currentUser.name} (${currentUser.email})`));
  } else {
    console.log(chalk.yellow('Logged in as Guest/Visitor'));
  }
  console.log(chalk.gray('===============================================\n'));
}

// Auth Screen: Login, Sign Up, or Bypass
async function showAuthMenu() {
  printHeader();
  const hasSavedAuth = await loadAuth();
  
  if (hasSavedAuth) {
    console.log(chalk.green(`Welcome back, ${currentUser.name}!`));
    const { autoLogin } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'autoLogin',
        message: 'Continue with saved credentials?',
        default: true,
      },
    ]);
    
    if (autoLogin) {
      return;
    } else {
      await clearAuth();
    }
  }

  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'Choose an option to continue:',
      choices: ['Log in', 'Sign up', 'Bypass login to view app', 'Exit'],
    },
  ]);

  if (choice === 'Exit') {
    console.log(chalk.blue('Goodbye!'));
    process.exit(0);
  }

  if (choice === 'Bypass login to view app') {
    currentUser = { name: 'visitor_user', email: 'visitor@example.com' };
    return;
  }

  if (choice === 'Log in' || choice === 'Sign up') {
    const questions = [];
    if (choice === 'Sign up') {
      questions.push({
        type: 'input',
        name: 'name',
        message: 'Full Name:',
        validate: (val) => (val.trim() ? true : 'Please enter your name'),
      });
    }
    questions.push(
      {
        type: 'input',
        name: 'email',
        message: 'Username or Email:',
        validate: (val) => (val.trim() ? true : 'Please enter username/email'),
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
        validate: (val) => (val.trim() ? true : 'Please enter password'),
      }
    );

    const answers = await inquirer.prompt(questions);
    const displayName = choice === 'Sign up' ? answers.name : answers.email.split('@')[0];
    
    await saveAuth(displayName, answers.email);
    console.log(chalk.green(`\nSuccessfully logged in as ${displayName}!`));
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// Show Feed
async function showFeed() {
  if (posts.length === 0) {
    await fetchPosts(1, true);
  }

  while (true) {
    printHeader();
    console.log(chalk.bold.yellow('--- POST FEED ---'));
    
    posts.forEach((post, index) => {
      const likeStatus = post.isLiked ? chalk.red('♥') : chalk.gray('♡');
      const bookmarkStatus = bookmarkedPosts.has(post.id) ? chalk.yellow('★') : chalk.gray('☆');
      console.log(
        `${chalk.bold(index + 1)}. [${likeStatus} Likes: ${post.likes}] [${bookmarkStatus}] ${chalk.cyan('@' + post.username)} (${post.location})`
      );
      // Truncate caption for feed overview
      const cleanCaption = post.caption.length > 70 ? `${post.caption.slice(0, 70)}...` : post.caption;
      console.log(`   "${chalk.italic(cleanCaption)}"`);
      console.log(`   Comments: ${post.comments.length}\n`);
    });

    const feedChoices = [
      ...posts.map((p, idx) => ({ name: `View post detail: @${p.username} (${p.id})`, value: { action: 'view', index: idx } })),
      { name: chalk.bold.green('➕ Load More Posts'), value: { action: 'load_more' } },
      { name: chalk.bold.red('🔓 Logout'), value: { action: 'logout' } },
      { name: chalk.bold.red('🚪 Exit'), value: { action: 'exit' } },
    ];

    const { menuAction } = await inquirer.prompt([
      {
        type: 'list',
        name: 'menuAction',
        message: 'Select an action:',
        choices: feedChoices,
        pageSize: 15,
      },
    ]);

    if (menuAction.action === 'exit') {
      console.log(chalk.blue('Goodbye!'));
      process.exit(0);
    }

    if (menuAction.action === 'logout') {
      await clearAuth();
      return; // return to auth screen
    }

    if (menuAction.action === 'load_more') {
      page += 1;
      await fetchPosts(page, false);
      continue;
    }

    if (menuAction.action === 'view') {
      await showPostDetail(menuAction.index);
    }
  }
}

// Show Post Detail
async function showPostDetail(index) {
  while (true) {
    const post = posts[index];
    printHeader();
    const likeStatus = post.isLiked ? chalk.red('♥') : chalk.gray('♡');
    const bookmarkStatus = bookmarkedPosts.has(post.id) ? chalk.yellow('★') : chalk.gray('☆');

    console.log(chalk.bold.yellow(`--- POST DETAIL (ID: ${post.id}) ---`));
    console.log(`${chalk.cyan('@' + post.username)} - ${chalk.gray(post.location)}`);
    console.log(`${chalk.gray('Avatar URL: ')} ${chalk.underline(post.avatar)}`);
    console.log(`${chalk.gray('Image URL:  ')} ${chalk.underline(post.imageUrl)}`);
    console.log(`${chalk.bold(likeStatus + ' ' + post.likes)} Likes  |  ${bookmarkStatus} Bookmarked`);
    console.log(`\n${chalk.bold('Caption:')}`);
    console.log(post.caption);
    console.log(`\n${chalk.bold('Comments:')}`);
    
    if (post.comments.length === 0) {
      console.log(chalk.gray('  No comments yet.'));
    } else {
      post.comments.forEach((c, cIdx) => {
        const cLikeStatus = c.isLiked ? chalk.red('♥') : chalk.gray('♡');
        console.log(
          `  ${cIdx + 1}. [${cLikeStatus}] ${chalk.bold('@' + c.username)}: ${c.text}`
        );
      });
    }
    console.log(chalk.gray('\n-----------------------------------------------'));

    const detailChoices = [
      { name: post.isLiked ? '♡ Unlike Post' : '♥ Like Post', value: 'toggle_like' },
      { name: '💬 Add Comment', value: 'add_comment' },
      { name: '❤️ Like/Unlike a Comment', value: 'toggle_comment_like' },
      { name: '🔗 Share (Copy Image URL to Clipboard)', value: 'share' },
      { name: bookmarkedPosts.has(post.id) ? '☆ Remove Bookmark' : '★ Bookmark Post', value: 'toggle_bookmark' },
      { name: '⬅️ Back to Feed', value: 'back' },
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select action:',
        choices: detailChoices,
      },
    ]);

    if (action === 'back') {
      break;
    }

    if (action === 'toggle_like') {
      post.isLiked = !post.isLiked;
      post.likes = post.isLiked ? post.likes + 1 : post.likes - 1;
    }

    if (action === 'toggle_bookmark') {
      if (bookmarkedPosts.has(post.id)) {
        bookmarkedPosts.delete(post.id);
        console.log(chalk.yellow('\nRemoved bookmark!'));
      } else {
        bookmarkedPosts.add(post.id);
        console.log(chalk.green('\nPost bookmarked!'));
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    if (action === 'share') {
      try {
        clipboardy.writeSync(post.imageUrl);
        console.log(chalk.green('\nPost link copied to clipboard!'));
      } catch (err) {
        console.log(chalk.red('\nCould not copy to clipboard. Image URL: ' + post.imageUrl));
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    if (action === 'add_comment') {
      const { commentText } = await inquirer.prompt([
        {
          type: 'input',
          name: 'commentText',
          message: 'Write a comment:',
          validate: (val) => (val.trim() ? true : 'Comment cannot be empty'),
        },
      ]);
      
      post.comments.push({
        id: Date.now().toString(),
        username: currentUser ? currentUser.name : 'visitor',
        text: commentText.trim(),
        isLiked: false,
      });
      console.log(chalk.green('\nComment posted!'));
      await new Promise((r) => setTimeout(r, 800));
    }

    if (action === 'toggle_comment_like') {
      if (post.comments.length === 0) {
        console.log(chalk.red('\nNo comments to like.'));
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      const { commentIdx } = await inquirer.prompt([
        {
          type: 'list',
          name: 'commentIdx',
          message: 'Choose a comment to like/unlike:',
          choices: post.comments.map((c, idx) => ({
            name: `${idx + 1}. @${c.username}: ${c.text.slice(0, 30)}...`,
            value: idx,
          })),
        },
      ]);

      const targetComment = post.comments[commentIdx];
      targetComment.isLiked = !targetComment.isLiked;
      console.log(chalk.green(`\nUpdated like status for @${targetComment.username}'s comment!`));
      await new Promise((r) => setTimeout(r, 800));
    }
  }
}

// Main Runner
async function main() {
  while (true) {
    await showAuthMenu();
    await showFeed();
  }
}

main().catch((err) => {
  console.error(chalk.red('Critical CLI error:', err));
  process.exit(1);
});
