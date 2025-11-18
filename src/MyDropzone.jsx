import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";

function MyDropzone() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [unfollowers, setUnfollowers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState(null);
  const [ignoredUsers, setIgnoredUsers] = useState(new Set());

  // Carica la lista degli utenti ignorati da localStorage
  const loadIgnoredUsers = () => {
    try {
      const stored = localStorage.getItem("instagram_ignored_users");
      if (stored) {
        const users = JSON.parse(stored);
        setIgnoredUsers(new Set(users));
        console.log(`Caricati ${users.length} utenti ignorati da localStorage`);
      }
    } catch (err) {
      console.log("Nessun utente ignorato salvato");
    }
  };

  // Salva la lista degli utenti ignorati in localStorage
  const saveIgnoredUsers = (users) => {
    try {
      localStorage.setItem(
        "instagram_ignored_users",
        JSON.stringify(Array.from(users))
      );
    } catch (err) {
      console.error("Errore nel salvataggio:", err);
    }
  };

  // Esporta la lista ignorati come file JSON
  const exportIgnoredList = () => {
    const data = JSON.stringify(Array.from(ignoredUsers), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ignored_users.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Importa la lista ignorati da file JSON
  const importIgnoredList = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (Array.isArray(data)) {
          const newIgnoredUsers = new Set(data);
          setIgnoredUsers(newIgnoredUsers);
          saveIgnoredUsers(newIgnoredUsers);
          alert(`Importati ${data.length} utenti ignorati!`);
        } else {
          alert("Formato file non valido!");
        }
      } catch (err) {
        alert("Errore nel caricamento del file: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  // Ignora un utente
  const ignoreUser = (username) => {
    const newIgnoredUsers = new Set(ignoredUsers);
    newIgnoredUsers.add(username.toLowerCase());
    setIgnoredUsers(newIgnoredUsers);
    saveIgnoredUsers(newIgnoredUsers);

    // Rimuovi l'utente dalla lista degli unfollowers
    setUnfollowers((prev) =>
      prev.filter((u) => u.username.toLowerCase() !== username.toLowerCase())
    );

    // Aggiorna le statistiche
    if (stats) {
      setStats({
        ...stats,
        unfollowers: stats.unfollowers - 1,
        ignored: stats.ignored + 1,
      });
    }
  };

  // Ignora tutti gli unfollowers attuali
  const ignoreAllUnfollowers = () => {
    if (unfollowers.length === 0) return;

    const message = `Vuoi ignorare tutti i ${unfollowers.length} utenti che non ti seguono?`;
    if (window.confirm(message)) {
      const newIgnoredUsers = new Set(ignoredUsers);
      unfollowers.forEach((user) => {
        newIgnoredUsers.add(user.username.toLowerCase());
      });

      setIgnoredUsers(newIgnoredUsers);
      saveIgnoredUsers(newIgnoredUsers);

      // Aggiorna statistiche
      if (stats) {
        setStats({
          ...stats,
          unfollowers: 0,
          ignored: newIgnoredUsers.size,
        });
      }

      setUnfollowers([]);
      alert(`${unfollowers.length} utenti ignorati con successo!`);
    }
  };

  // Ripristina un utente ignorato
  const unignoreUser = (username) => {
    const newIgnoredUsers = new Set(ignoredUsers);
    newIgnoredUsers.delete(username.toLowerCase());
    setIgnoredUsers(newIgnoredUsers);
    saveIgnoredUsers(newIgnoredUsers);

    // Aggiorna statistiche
    if (stats) {
      setStats({
        ...stats,
        ignored: stats.ignored - 1,
      });
    }
  };

  // Cancella tutti gli utenti ignorati
  const clearAllIgnored = () => {
    if (window.confirm("Vuoi cancellare tutti gli utenti ignorati?")) {
      setIgnoredUsers(new Set());
      try {
        localStorage.removeItem("instagram_ignored_users");
        if (stats) {
          setStats({
            ...stats,
            ignored: 0,
          });
        }
      } catch (err) {
        console.error("Errore nella cancellazione:", err);
      }
    }
  };

  const extractAndAnalyze = async (zipFile) => {
    setIsProcessing(true);
    setError("");
    setUnfollowers([]);
    setStats(null);

    // Carica gli utenti ignorati da localStorage
    let currentIgnoredUsers = ignoredUsers;
    try {
      const stored = localStorage.getItem("instagram_ignored_users");
      if (stored) {
        const users = JSON.parse(stored);
        currentIgnoredUsers = new Set(users);
        setIgnoredUsers(currentIgnoredUsers);
        console.log(`Caricati ${users.length} utenti ignorati da localStorage`);
      }
    } catch (err) {
      console.log("Nessun utente ignorato salvato");
    }

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipFile);

      let followersFile = null;
      let followingFile = null;

      Object.keys(contents.files).forEach((filename) => {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes("followers_1") && lowerName.endsWith(".json")) {
          followersFile = contents.files[filename];
        }
        if (
          lowerName.includes("following") &&
          lowerName.endsWith(".json") &&
          !lowerName.includes("hashtag") &&
          !lowerName.includes("restricted") &&
          !lowerName.includes("close_friends") &&
          lowerName.includes("following.json")
        ) {
          followingFile = contents.files[filename];
        }
      });

      if (!followersFile) {
        setError("File followers_1.json non trovato nello ZIP");
        return;
      }

      if (!followingFile) {
        setError("File following.json non trovato nello ZIP");
        return;
      }

      const followersText = await followersFile.async("text");
      const followingText = await followingFile.async("text");

      let followersData = JSON.parse(followersText);
      let followingData = JSON.parse(followingText);

      if (!Array.isArray(followersData)) {
        const keys = Object.keys(followersData);
        for (const key of keys) {
          if (Array.isArray(followersData[key])) {
            followersData = followersData[key];
            break;
          }
        }
      }

      if (!Array.isArray(followingData)) {
        const keys = Object.keys(followingData);
        for (const key of keys) {
          if (Array.isArray(followingData[key])) {
            followingData = followingData[key];
            break;
          }
        }
      }

      // Passa gli utenti ignorati correnti alla funzione di analisi
      analyzeData(followersData, followingData, currentIgnoredUsers);
    } catch (err) {
      setError("Errore durante l'analisi: " + err.message);
      console.error("Errore completo:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const analyzeData = (
    followersData,
    followingData,
    currentIgnoredUsers = ignoredUsers
  ) => {
    try {
      const getUsername = (item, fileType) => {
        if (fileType === "Follower") {
          if (item.string_list_data && item.string_list_data.length > 0) {
            return item.string_list_data[0].value;
          }
          if (item.value) return item.value;
          if (item.username) return item.username;
        } else {
          if (item.title) {
            return item.title;
          }
        }
        return null;
      };

      const followerUsernames = new Set();

      followersData.forEach((follower) => {
        const username = getUsername(follower, "Follower");
        if (username) {
          followerUsernames.add(username.toLowerCase());
        }
      });

      const notFollowingBack = [];

      followingData.forEach((following) => {
        const username = getUsername(following, "Following");
        // Usa currentIgnoredUsers invece di ignoredUsers
        if (
          username &&
          !followerUsernames.has(username.toLowerCase()) &&
          !currentIgnoredUsers.has(username.toLowerCase())
        ) {
          notFollowingBack.push({
            username: username,
            timestamp: following.string_list_data?.[0]?.timestamp || null,
          });
        }
      });

      notFollowingBack.sort((a, b) =>
        a.username.toLowerCase().localeCompare(b.username.toLowerCase())
      );

      setUnfollowers(notFollowingBack);
      setStats({
        followers: followerUsernames.size,
        following: followingData.length,
        unfollowers: notFollowingBack.length,
        mutualFollows:
          followingData.length -
          notFollowingBack.length -
          currentIgnoredUsers.size,
        ignored: currentIgnoredUsers.size,
      });
    } catch (err) {
      setError("Errore nell'analisi dei dati: " + err.message);
      console.error("Errore analisi:", err);
    }
  };

  const validateZipFile = (file) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return "Il file deve avere estensione .zip";
    }

    const validTypes = [
      "application/zip",
      "application/x-zip-compressed",
      "application/x-zip",
    ];
    if (file.type && !validTypes.includes(file.type)) {
      return "Il file deve essere un archivio ZIP valido";
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return "Il file è troppo grande (max 100MB)";
    }

    return null;
  };

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      setError("");
      setUnfollowers([]);
      setStats(null);

      if (rejectedFiles.length > 0) {
        setError("Per favore carica solo file ZIP!");
        return;
      }

      if (acceptedFiles.length === 0) return;

      const selectedFile = acceptedFiles[0];

      const validationError = validateZipFile(selectedFile);
      if (validationError) {
        setError(validationError);
        return;
      }

      setFile(selectedFile);
      extractAndAnalyze(selectedFile);
    },
    [] // Rimuovi ignoredUsers dalla dipendenza
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const exportToText = () => {
    const text = unfollowers.map((u) => u.username).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unfollowers.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #0087F7",
          borderRadius: "8px",
          padding: "40px",
          textAlign: "center",
          cursor: "pointer",
          backgroundColor: isDragActive ? "#669bbc" : "#003049",
          transition: "background-color 0.2s",
          marginBottom: "20px",
        }}
      >
        <input {...getInputProps()} />

        {isDragActive ? (
          <p style={{ fontSize: "18px", margin: 0, color: "white" }}>
            📦 Rilascia il file ZIP qui...
          </p>
        ) : (
          <div>
            <p
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                margin: "0 0 10px 0",
                color: "white",
              }}
            >
              📁 Trascina qui il file ZIP di Instagram
            </p>
            <p style={{ fontSize: "14px", color: "#c9ada7", margin: 0 }}>
              oppure clicca per selezionarlo
            </p>
          </div>
        )}

        {error && (
          <p
            style={{
              color: "#d32f2f",
              fontWeight: "bold",
              marginTop: "15px",
              padding: "10px",
              backgroundColor: "#ffebee",
              borderRadius: "4px",
            }}
          >
            ❌ {error}
          </p>
        )}

        {file && !error && !isProcessing && (
          <p
            style={{
              color: "#2e7d32",
              fontWeight: "bold",
              marginTop: "15px",
              padding: "10px",
              backgroundColor: "#e8f5e9",
              borderRadius: "4px",
            }}
          >
            ✓ File caricato: {file.name}
          </p>
        )}
      </div>

      {isProcessing && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            backgroundColor: "#fff3e0",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <p style={{ fontSize: "18px", margin: 0 }}>⏳ Analisi in corso...</p>
        </div>
      )}

      {(ignoredUsers.size > 0 || stats) && (
        <div
          style={{
            backgroundColor: "#003049",
            borderRadius: "8px",
            padding: "15px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: ignoredUsers.size > 0 ? "10px" : "0",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <h4 style={{ margin: 0, color: "white" }}>
              🔇 Utenti ignorati ({ignoredUsers.size})
            </h4>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {ignoredUsers.size > 0 && (
                <button
                  onClick={exportIgnoredList}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#0087F7",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  💾 Esporta
                </button>
              )}
              <label
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#2e7d32",
                  color: "white",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                📂 Importa
                <input
                  type="file"
                  accept=".json"
                  onChange={importIgnoredList}
                  style={{ display: "none" }}
                />
              </label>
              {ignoredUsers.size > 0 && (
                <button
                  onClick={clearAllIgnored}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: "#d32f2f",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  🗑️ Cancella tutti
                </button>
              )}
            </div>
          </div>
          {ignoredUsers.size > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {Array.from(ignoredUsers).map((username, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: "#669bbc",
                    padding: "5px 10px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                  }}
                >
                  <span>@{username}</span>
                  <button
                    onClick={() => unignoreUser(username)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "16px",
                      color: "#fff",
                      padding: "0",
                    }}
                    title="Ripristina utente"
                  >
                    ↺
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {stats && (
        <div
          style={{
            backgroundColor: "#e3f2fd",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ marginTop: 0 }}>📊 Statistiche</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "15px",
            }}
          >
            <div
              style={{
                backgroundColor: "white",
                padding: "15px",
                borderRadius: "4px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                Followers
              </p>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#2e7d32",
                }}
              >
                {stats.followers}
              </p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "15px",
                borderRadius: "4px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                Following
              </p>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#0087F7",
                }}
              >
                {stats.following}
              </p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "15px",
                borderRadius: "4px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                Non ti seguono
              </p>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#d32f2f",
                }}
              >
                {stats.unfollowers}
              </p>
            </div>
            <div
              style={{
                backgroundColor: "white",
                padding: "15px",
                borderRadius: "4px",
              }}
            >
              <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                Ignorati
              </p>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#ff9800",
                }}
              >
                {stats.ignored}
              </p>
            </div>
          </div>
        </div>
      )}

      {unfollowers.length > 0 && (
        <div
          style={{
            backgroundColor: "#ffebee",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <h3 style={{ margin: 0 }}>
              👥 Non ti seguono ({unfollowers.length})
            </h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={ignoreAllUnfollowers}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#ff9800",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                🔇 Ignora tutti
              </button>
              <button
                onClick={exportToText}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#0087F7",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                📥 Esporta lista
              </button>
            </div>
          </div>
          <div
            style={{
              maxHeight: "400px",
              overflow: "auto",
              backgroundColor: "white",
              borderRadius: "4px",
              padding: "10px",
            }}
          >
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {unfollowers.map((user, index) => (
                <li
                  key={index}
                  style={{
                    padding: "10px",
                    borderBottom:
                      index < unfollowers.length - 1
                        ? "1px solid #eee"
                        : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <a
                    href={`https://instagram.com/${user.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#0087F7",
                      textDecoration: "none",
                      fontWeight: "500",
                      flex: 1,
                    }}
                  >
                    @{user.username}
                  </a>
                  <button
                    onClick={() => ignoreUser(user.username)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#ff9800",
                      color: "white",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                    title="Ignora questo utente"
                  >
                    🔇 Ignora
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyDropzone;
