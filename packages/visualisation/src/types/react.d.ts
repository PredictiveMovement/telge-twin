import * as React from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

declare global {
  namespace JSX {
    interface ElementClass {
      render?: any
    }
    interface IntrinsicElements {
      [elemName: string]: any
    }
  }
}

declare global {
  namespace JSX {
    interface ElementClass {
      render?: any
    }

    interface IntrinsicElements {
      [elemName: string]: any
    }

    type Element = React.ReactElement<any, any> | null
  }
}
