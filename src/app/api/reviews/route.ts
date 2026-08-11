import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('place');

  if (!query) {
    return Response.json({ error: 'place parameter is required' }, { status: 400 });
  }

  const results: { videos: unknown[]; blogs: unknown[] } = {
    videos: [],
    blogs: [],
  };

  // --- YouTube search ---
  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (youtubeKey) {
    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent('"' + query + '"')}&type=video&key=${youtubeKey}&relevanceLanguage=ko`;
      const ytRes = await fetch(ytUrl);
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        results.videos = (ytData.items || []).map(
          (item: {
            id: { videoId: string };
            snippet: {
              title: string;
              thumbnails: { medium: { url: string } };
              channelTitle: string;
              publishedAt: string;
            };
          }) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.medium.url,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          })
        );
      }
    } catch {
      // YouTube search failed silently
    }
  }

  // --- Naver Blog search ---
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
  if (naverClientId && naverClientSecret) {
    try {
      const blogUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent('"' + query + '"')}&display=6&sort=sim`;
      const blogRes = await fetch(blogUrl, {
        headers: {
          'X-Naver-Client-Id': naverClientId,
          'X-Naver-Client-Secret': naverClientSecret,
        },
      });
      if (blogRes.ok) {
        const blogData = await blogRes.json();
        results.blogs = (blogData.items || []).map(
          (item: {
            title: string;
            description: string;
            link: string;
            bloggername: string;
            postdate: string;
          }) => ({
            title: item.title,
            description: item.description,
            link: item.link,
            bloggername: item.bloggername,
            postdate: item.postdate,
          })
        );
      }
    } catch {
      // Blog search failed silently
    }
  }

  return Response.json(results);
}
