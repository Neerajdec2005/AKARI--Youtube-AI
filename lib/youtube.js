/**
 * Fetch trending regular videos for the given category using the YouTube Data API.
 */
export async function fetchTrendingVideos(category = 'tech') {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&q=${encodeURIComponent(category)}&key=${apiKey}&maxResults=5`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      // Structure only the necessary fields.
      const videos = data.items.map(item => ({
        title: item.snippet.title,
        description: item.snippet.description,
        videoId: item.id.videoId,
        publishTime: item.snippet.publishTime || '',
      }));
      return videos;
    } catch (error) {
      console.error('Error fetching trending videos:', error);
      return [];
    }
  }
  
  /**
   * Fetch trending shorts for the given category.
   * (This is a simplistic approach—filtering videos that include the word "Shorts" or using a dedicated query.)
   */
  export async function fetchTrendingShorts(category = 'tech') {
    const apiKey = process.env.YOUTUBE_API_KEY;
    // Adjust query to try to find shorts.
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&q=${encodeURIComponent(category + " shorts")}&key=${apiKey}&maxResults=5`;
    
    try {
      const res = await fetch(url);
      const data = await res.json();
      const shorts = data.items.map(item => ({
        title: item.snippet.title,
        description: item.snippet.description,
        videoId: item.id.videoId,
        publishTime: item.snippet.publishTime || '',
      }));
      return shorts;
    } catch (error) {
      console.error('Error fetching trending shorts:', error);
      return [];
    }
  }
  