export interface Config {
  costInsights?: {
    /**
     * Environment ids exposed to the UI and API.
     * @example ['dev', 'stg', 'prod']
     */
    environments?: string[];

    /**
     * Default environment used when query param is omitted.
     * Must exist in `costInsights.environments`.
     * @example 'prod'
     */
    defaultEnvironment?: string;

    /**
     * HTTP auth behavior for cost-insights backend routes.
     */
    auth?: {
      /**
       * Allow unauthenticated access.
       * Keep false by default for safer deployments.
       * @default false
       */
      allowUnauthenticated?: boolean;
    };

    s3?: {
      /**
       * AWS region.
       * @example 'ap-northeast-2'
       */
      region: string;

      /**
       * CUR result bucket name.
       */
      bucket: string;

      /**
       * Optional AWS profile for local/SSO usage.
       * If omitted, default credential chain is used.
       */
      profile?: string;

      /**
       * Prefix template for daily files.
       * Supported tokens: {environment}, {yearMonth}, {year}, {month}
       * @default '{environment}/daily/{yearMonth}/'
       */
      dailyPrefixTemplate?: string;
    };
  };
}
