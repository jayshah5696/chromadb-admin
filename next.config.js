/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    });

    // Ignore https:// imports from chromadb (browser-only code path)
    config.module.rules.push({
      test: /\.mjs$/,
      include: /chromadb/,
      resolve: {
        fullySpecified: false,
      },
    });

    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^https:\/\//,
      })
    );

    return config;
  },
}

module.exports = nextConfig
