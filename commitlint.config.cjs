module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat',     // New feature
                'fix',      // Bug fix
                'docs',     // Documentation
                'style',    // Formatting, no code change
                'refactor', // Code refactoring
                'perf',     // Performance improvement
                'test',     // Adding tests
                'build',    // Build system changes
                'ci',       // CI configuration
                'chore',    // Maintenance tasks
                'revert',   // Revert changes
            ],
        ],
        'subject-case': [2, 'always', 'lower-case'],
        'header-max-length': [2, 'always', 100],
    },
};
