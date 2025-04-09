var posts=["2023/03/20/hello-world/","2023/03/28/my-first-blog/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };