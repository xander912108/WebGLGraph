declare module 'react-force-graph-2d' {
  import type { Component } from 'react';
  interface ForceGraphProps {
    ref?: any;
    graphData: { nodes: any[]; links: any[] };
    width?: number;
    height?: number;
    backgroundColor?: string;
    nodeCanvasObject?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    nodeCanvasObjectMode?: string | (() => string);
    linkCanvasObject?: (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => void;
    linkCanvasObjectMode?: string | (() => string);
    nodeRelSize?: number;
    nodeVal?: string | number | ((node: any) => number);
    linkWidth?: string | number | ((link: any) => number);
    linkColor?: string | ((link: any) => string);
    onNodeClick?: (node: any) => void;
    onNodeHover?: (node: any) => void;
    onNodeDragEnd?: (node: any) => void;
    onLinkHover?: (link: any) => void;
    onZoomChange?: (zoom: number) => void;
    onBackgroundClick?: () => void;
    enableNodeDrag?: boolean;
    minZoom?: number;
    maxZoom?: number;
    warmupTicks?: number;
    cooldownTicks?: number;
    autoPauseRedraw?: boolean;
    [key: string]: any;
  }
  export default class ForceGraph2D extends Component<ForceGraphProps> {}
}
