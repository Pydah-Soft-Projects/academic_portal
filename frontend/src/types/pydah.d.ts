import * as React from "react";

export interface PydahSsoLoaderAttributes
  extends React.HTMLAttributes<HTMLElement> {
  portal?: string;
  title?: string;
  heading?: string;
  detail?: string;
  "api-base-url"?: string;
}

export interface PydahPortalSwitcherAttributes
  extends React.HTMLAttributes<HTMLElement> {
  "current-portal"?: string;
  "api-base-url"?: string;
  position?: "bottom-right" | "bottom-left";
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "pydah-sso-loader": React.DetailedHTMLProps<
        PydahSsoLoaderAttributes,
        HTMLElement
      >;
      "pydah-portal-switcher": React.DetailedHTMLProps<
        PydahPortalSwitcherAttributes,
        HTMLElement
      >;
    }
  }
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "pydah-sso-loader": React.DetailedHTMLProps<
          PydahSsoLoaderAttributes,
          HTMLElement
        >;
        "pydah-portal-switcher": React.DetailedHTMLProps<
          PydahPortalSwitcherAttributes,
          HTMLElement
        >;
      }
    }
  }
}
