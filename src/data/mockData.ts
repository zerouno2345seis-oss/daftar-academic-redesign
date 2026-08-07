import { SearchResultItem } from '../types';

export const INITIAL_SEARCH_RESULTS: SearchResultItem[] = [
  {
    id: 'yt-1',
    title: 'Advanced NGINX Configuration for High Traffic Nodes',
    duration: '14:23',
    url: 'https://youtube.com/watch?v=tech01_alpha',
    thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=500&auto=format&fit=crop&q=60',
    thumbnailAlt: 'Technical server nodes visualization',
    selected: false,
    channelTitle: 'SysOps Daily',
    views: '124K views',
    publishedAt: '2 days ago'
  },
  {
    id: 'yt-2',
    title: 'Load Balancing Architecture Explained',
    duration: '08:45',
    url: 'https://youtube.com/watch?v=sys_arch_89',
    thumbnail: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500&auto=format&fit=crop&q=60',
    thumbnailAlt: 'Load balancer prism beams',
    selected: true,
    channelTitle: 'Tech Architecture Pro',
    views: '89K views',
    publishedAt: '1 week ago'
  },
  {
    id: 'yt-3',
    title: 'Zero-Downtime Deployments in Kubernetes Clusters',
    duration: '42:10',
    url: 'https://youtube.com/watch?v=k8s_deploy_v2',
    thumbnail: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=500&auto=format&fit=crop&q=60',
    thumbnailAlt: 'Kubernetes glass blocks deployment',
    selected: false,
    channelTitle: 'Cloud Native Academy',
    views: '310K views',
    publishedAt: '3 weeks ago'
  },
  {
    id: 'yt-4',
    title: 'Hardening Linux Servers against Modern Threats',
    duration: '18:30',
    url: 'https://youtube.com/watch?v=sec_audit_x',
    thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&auto=format&fit=crop&q=60',
    thumbnailAlt: 'Shield icon server security',
    selected: true,
    channelTitle: 'CyberSec Labs',
    views: '45K views',
    publishedAt: '1 month ago'
  },
  {
    id: 'yt-5',
    title: 'Full Stack React 19 & Node.js Crash Course 2026',
    duration: '2:15:40',
    url: 'https://youtube.com/watch?v=react19_full_course',
    thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=500&auto=format&fit=crop&q=60',
    thumbnailAlt: 'React code screen',
    selected: false,
    channelTitle: 'Code With Master',
    views: '512K views',
    publishedAt: '4 days ago'
  },
  {
    id: 'yt-6',
    title: 'Building High Performance APIs with Go & Fiber',
    duration: '25:12',
    url: 'https://youtube.com/watch?v=golang_fiber_api',
    thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=500&auto=format&fit=crop&q=60',
    thumbnailAlt: 'Developer workstation',
    selected: false,
    channelTitle: 'Backend Ninja',
    views: '67K views',
    publishedAt: '5 days ago'
  }
];
