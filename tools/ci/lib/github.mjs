// tools/ci/lib/github.mjs
// A minimal GitHub REST client for the workflows: plain fetch with the job's
// GITHUB_TOKEN, no dependencies. Only the calls the submission flow needs.

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';

export const createGitHub = ({ token = process.env.GITHUB_TOKEN, repository = process.env.GITHUB_REPOSITORY } = {}) => {
    if (!token) throw new Error('GITHUB_TOKEN is not set');
    if (!repository) throw new Error('GITHUB_REPOSITORY is not set');

    const request = async (method, route, body) => {
        const response = await fetch(`${API}${route}`, {
            method,
            headers: {
                accept: 'application/vnd.github+json',
                authorization: `Bearer ${token}`,
                'x-github-api-version': '2022-11-28',
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (response.status === 204) return null;
        const text = await response.text();
        const data = text ? JSON.parse(text) : null;
        if (!response.ok) {
            const error = new Error(`${method} ${route}: ${response.status} ${data?.message ?? text}`);
            error.status = response.status;
            throw error;
        }
        return data;
    };

    const repo = `/repos/${repository}`;

    const paginate = async (route) => {
        const items = [];
        for (let page = 1; page <= 30; page += 1) {
            const separator = route.includes('?') ? '&' : '?';
            const batch = await request('GET', `${route}${separator}per_page=100&page=${page}`);
            items.push(...batch);
            if (batch.length < 100) break;
        }
        return items;
    };

    return {
        repository,
        getPullRequest: (number) => request('GET', `${repo}/pulls/${number}`),
        listPullRequestFiles: (number) => paginate(`${repo}/pulls/${number}/files`),
        getIssue: (number) => request('GET', `${repo}/issues/${number}`),
        listOpenIssuesWithLabel: (label) => paginate(`${repo}/issues?state=open&labels=${encodeURIComponent(label)}`),
        /** The collaborator permission of a user: 'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none'. */
        getPermission: async (username) => {
            try {
                const data = await request('GET', `${repo}/collaborators/${encodeURIComponent(username)}/permission`);
                return data?.role_name ?? data?.permission ?? 'none';
            } catch (error) {
                if (error.status === 404) return 'none';
                throw error;
            }
        },
        /*
         * Creates or updates the bot's comment carrying `marker`, so a re-run edits
         * its previous result instead of piling up comments.
         */
        upsertComment: async (number, marker, body) => {
            const comments = await paginate(`${repo}/issues/${number}/comments`);
            const existing = comments.find((comment) => comment.user?.type === 'Bot' && comment.body?.includes(marker));
            if (existing) return request('PATCH', `${repo}/issues/comments/${existing.id}`, { body });
            return request('POST', `${repo}/issues/${number}/comments`, { body });
        },
        comment: (number, body) => request('POST', `${repo}/issues/${number}/comments`, { body }),
        react: (commentId, content) => request('POST', `${repo}/issues/comments/${commentId}/reactions`, { content }),
        addLabels: (number, labels) => request('POST', `${repo}/issues/${number}/labels`, { labels }),
        removeLabel: async (number, label) => {
            try {
                await request('DELETE', `${repo}/issues/${number}/labels/${encodeURIComponent(label)}`);
            } catch (error) {
                if (error.status !== 404) throw error;
            }
        },
        closeIssue: (number) => request('PATCH', `${repo}/issues/${number}`, { state: 'closed', state_reason: 'completed' }),
    };
};

/** Swaps the pass/fail labels on an issue or pull request. */
export const setCheckLabels = async (github, number, passed, labels) => {
    if (passed) {
        await github.removeLabel(number, labels.needsChanges);
        await github.addLabels(number, [labels.awaitingReview]);
    } else {
        await github.removeLabel(number, labels.awaitingReview);
        await github.addLabels(number, [labels.needsChanges]);
    }
};
