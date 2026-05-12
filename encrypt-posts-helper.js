// encrypt-posts-helper.js
// Requires blog.html to have already defined: window.encryptContent, window.encryptObject

(async () => {
  function assert(cond, msg) { if (!cond) throw new Error(msg); }

  async function loadPosts(url = "blog-posts.json") {
    const res = await fetch(url, { cache: "no-store" });
    assert(res.ok, `Failed to fetch ${url}: ${res.status}`);
    return await res.json();
  }

  function downloadJson(obj, filename = "blog-posts.json") {
    const blob = new Blob([JSON.stringify(obj, null, 4)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function findPost(posts, { id, title }) {
    if (id) return posts.find(p => p.id === id);
    if (title) return posts.find(p => p.title === title);
    return null;
  }

  function buildMetadataFromPost(p) {
    return {
      mood: p.mood,
      emoji: p.emoji,
      picture: p.picture,
      spotify: p.spotify,
      other_song: p.other_song
    };
  }

  function stripPlaintextFields(p) {
    delete p.content;
    delete p.mood;
    delete p.emoji;
    delete p.picture;
    delete p.spotify;
    delete p.other_song;
  }

  // Public API
  window.BlogCrypto = {
    async encryptPost({ id, title, password, postsUrl = "blog-posts.json" }) {
      assert(password && typeof password === "string", "password required");
      assert(window.encryptContent && window.encryptObject, "encrypt helpers not found on window");

      const posts = await loadPosts(postsUrl);
      const p = findPost(posts, { id, title });
      assert(p, `Post not found (id=${id || ""}, title=${title || ""})`);

      // Encrypt content + metadata
      p.encrypted_content = await window.encryptContent(p.content, password);
      const meta = buildMetadataFromPost(p);
      p.encrypted_metadata = await window.encryptObject(meta, password);

      stripPlaintextFields(p);

      downloadJson(posts, "blog-posts.json");
      return { ok: true, id: p.id, title: p.title };
    },

    async encryptMany({ ids = [], titles = [], password, postsUrl = "blog-posts.json" }) {
      assert(password && typeof password === "string", "password required");
      const posts = await loadPosts(postsUrl);

      const targets = posts.filter(p =>
        (ids.length && ids.includes(p.id)) || (titles.length && titles.includes(p.title))
      );
      assert(targets.length, "No matching posts found");

      for (const p of targets) {
        p.encrypted_content = await window.encryptContent(p.content, password);
        p.encrypted_metadata = await window.encryptObject(buildMetadataFromPost(p), password);
        stripPlaintextFields(p);
      }

      downloadJson(posts, "blog-posts.json");
      return { ok: true, count: targets.length };
    }
  };

  console.log("BlogCrypto ready. Example:");
  console.log(`await BlogCrypto.encryptPost({ id: "the-test", password: "..." })`);
})();
