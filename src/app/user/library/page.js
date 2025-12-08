"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Header from "@/components/Header";
import { Loader2, Lock, Globe, Music, Edit2, Trash2, Upload, LayoutGrid } from "lucide-react";
import useUI from "@/hooks/useUI";
import Link from "next/link";
import useUploadModal from "@/hooks/useUploadModal";
import { GlitchText, HoloButton, GlitchButton } from "@/components/CyberComponents";

// --- SKELETON COMPONENT (Hiệu ứng Loading từ Stash) ---
const ContentSkeleton = () => {
  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Filter Bar Skeleton */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
         <div className="h-8 w-64 bg-neutral-200 dark:bg-white/5 rounded-lg animate-pulse"></div>
         <div className="h-4 w-32 bg-neutral-200 dark:bg-white/5 rounded animate-pulse md:ml-auto"></div>
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
         {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4 rounded-xl border border-neutral-200 dark:border-white/5 bg-white/50 dark:bg-neutral-900/50 flex flex-col gap-3">
                <div className="w-full aspect-square bg-neutral-300 dark:bg-white/10 rounded-lg animate-pulse relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                    <div className="absolute bottom-2 left-2 h-5 w-16 bg-neutral-400 dark:bg-white/20 rounded"></div>
                </div>
                <div className="space-y-2">
                    <div className="h-5 w-3/4 bg-neutral-300 dark:bg-white/10 rounded animate-pulse"></div>
                    <div className="h-3 w-1/2 bg-neutral-200 dark:bg-white/5 rounded animate-pulse"></div>
                </div>
                <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-white/5 flex justify-between">
                      <div className="h-3 w-10 bg-neutral-200 dark:bg-white/5 rounded"></div>
                      <div className="h-3 w-12 bg-neutral-200 dark:bg-white/5 rounded"></div>
                </div>
            </div>
         ))}
      </div>
    </div>
  );
};

const MyUploadsPage = () => {
  // --- STATE ---
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingSong, setEditingSong] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', author: '', isPublic: false });
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // State bổ sung cho UI mới (từ Stash)
  const [activeTab, setActiveTab] = useState('uploads'); // 'uploads' or 'tuned'
  const [filter, setFilter] = useState('all'); // 'all', 'public', 'private'

  // --- HOOKS ---
  const { alert, confirm } = useUI();
  const { onOpen } = useUploadModal();

  useEffect(() => {
    getMyUploads();
  }, []);

  // --- LOGIC (Giữ nguyên từ Upstream để đảm bảo tính năng) ---
  const getMyUploads = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching uploads:', error);
      alert('Failed to load uploads', 'error');
    }

    setSongs(data || []);
    setLoading(false);
  };

  const handleDeleteSong = async (songId) => {
    const isConfirmed = await confirm(
      "Are you sure you want to delete this song? This action cannot be undone.",
      "DELETE_SONG"
    );

    if (!isConfirmed) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to delete songs', 'error');
        return;
      }

      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSongs(songs.filter(song => song.id !== songId));
      alert('Song deleted successfully!', 'success');
    } catch (err) {
      alert('Failed to delete song', 'error');
    }
  };

  const startEditing = (song) => {
    setEditingSong(song.id);
    setEditForm({ 
      title: song.title, 
      author: song.author, 
      isPublic: song.is_public ?? false 
    });
  };

  const cancelEditing = () => {
    setEditingSong(null);
    setEditForm({ title: '', author: '', isPublic: false });
    setSelectedFile(null);
    setSelectedImage(null);
  };

  const saveEdit = async () => {
    if (!editForm.title.trim()) {
      alert('Song title cannot be empty', 'error');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to edit songs', 'error');
        return;
      }

      let updateData = {
        title: editForm.title.trim(),
        author: editForm.author?.trim() || 'Unknown',
        is_public: Boolean(editForm.isPublic)
      };

      if (selectedFile || selectedImage) {
        const uniqueID = crypto.randomUUID();
        const safeTitle = editForm.title.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "").toLowerCase();

        if (selectedFile) {
          const songPath = `song-${safeTitle}-${uniqueID}`;
          const { data: songData, error: songError } = await supabase.storage
            .from('songs')
            .upload(songPath, selectedFile, { cacheControl: '3600', upsert: false });

          if (songError) throw new Error("Failed to upload song: " + songError.message);

          const { data: songUrlData } = supabase.storage.from('songs').getPublicUrl(songData.path);
          updateData.song_url = songUrlData.publicUrl;
        }

        if (selectedImage) {
          const imagePath = `image-${safeTitle}-${uniqueID}`;
          const { data: imageData, error: imageError } = await supabase.storage
            .from('images')
            .upload(imagePath, selectedImage, { cacheControl: '3600', upsert: false });

          if (imageError) throw new Error("Failed to upload image: " + imageError.message);

          const { data: imageUrlData } = supabase.storage.from('images').getPublicUrl(imageData.path);
          updateData.image_url = imageUrlData.publicUrl;
        }
      }

      const { data, error } = await supabase
        .from('songs')
        .update(updateData)
        .eq('id', editingSong)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
          throw new Error("Update failed. Row not found or permission denied.");
      }

      setSongs(songs.map(song =>
        song.id === editingSong
          ? { ...song, ...data[0] }
          : song
      ));

      cancelEditing();
      alert('Song updated successfully!', 'success');
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update song: ' + err.message, 'error');
    }
  };

  // --- HELPER LOGIC cho UI mới ---
  const filteredSongs = useMemo(() => {
    let result = songs;
    
    // Logic giả định cho tab 'tuned' (hiện tại chưa có data thật, tạm thời hiển thị rỗng hoặc tất cả)
    if (activeTab === 'tuned') {
        // TODO: Implement tuned songs logic
        return []; 
    }

    if (filter === 'public') {
      result = result.filter(s => s.is_public);
    } else if (filter === 'private') {
      result = result.filter(s => !s.is_public);
    }
    return result;
  }, [songs, filter, activeTab]);

  const isEditable = true; // Vì là trang My Uploads nên luôn có quyền sửa

  // --- SUB-COMPONENT: USER SONG CARD ---
  const UserSongCard = ({ song, isEditing }) => (
    <div className="group relative bg-neutral-100/50 dark:bg-black/40 border border-neutral-200 dark:border-white/5 p-4 rounded-xl hover:border-emerald-500/50 transition cursor-pointer overflow-hidden flex flex-col gap-3 shadow-sm hover:shadow-md">
       <div className="absolute top-2 right-2 z-20 flex gap-2">
         {(isEditing ? editForm.isPublic : song.is_public) ? (
           <div className="bg-green-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-mono">
             <Globe size={12} />
             Public
           </div>
         ) : (
           <div className="bg-red-500/90 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 font-mono">
             <Lock size={12} />
             Private
           </div>
         )}

         {!isEditing && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    startEditing(song);
                }}
                className="bg-blue-500/90 hover:bg-blue-600 text-white p-2 rounded-lg transition-colors"
                title="Edit song"
                >
                <Edit2 size={14} />
                </button>
                <button
                onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSong(song.id);
                }}
                className="bg-red-500/90 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                title="Delete song"
                >
                <Trash2 size={14} />
                </button>
            </div>
         )}
       </div>

       {/* IMAGE */}
       <div className="relative w-full aspect-square bg-neutral-300 dark:bg-neutral-800 rounded-lg overflow-hidden shadow-lg">
          <img
            src={song.image_url || '/images/music-placeholder.png'}
            alt={song.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
       </div>

       {/* INFO & EDIT FORM */}
       <div className="flex flex-col gap-1">
         {isEditing ? (
           <div className="space-y-2 p-2 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
             <input
               type="text"
               value={editForm.title}
               onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
               className="w-full px-2 py-1 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded focus:outline-none focus:border-emerald-500"
               placeholder="Song title"
             />
             <input
               type="text"
               value={editForm.author}
               onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
               className="w-full px-2 py-1 text-sm bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded focus:outline-none focus:border-emerald-500"
               placeholder="Artist"
             />

             <div className="flex items-center gap-3 py-2">
               <label className="flex items-center gap-2 cursor-pointer group">
                 <input
                   type="radio"
                   name={`visibility-${song.id}`}
                   value="true"
                   checked={editForm.isPublic === true}
                   onChange={(e) => setEditForm({ ...editForm, isPublic: true })}
                   className="accent-emerald-500 w-4 h-4 cursor-pointer"
                 />
                 <span className="text-xs text-white flex items-center gap-1 group-hover:text-emerald-400 transition"><Globe size={12}/> Public</span>
               </label>
               <label className="flex items-center gap-2 cursor-pointer group">
                 <input
                   type="radio"
                   name={`visibility-${song.id}`}
                   value="false"
                   checked={editForm.isPublic === false}
                   onChange={(e) => setEditForm({ ...editForm, isPublic: false })}
                   className="accent-red-500 w-4 h-4 cursor-pointer"
                 />
                 <span className="text-xs text-white flex items-center gap-1 group-hover:text-red-400 transition"><Lock size={12}/> Private</span>
               </label>
             </div>

             <div className="space-y-2">
               <div>
                 <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Song File (optional)</label>
                 <input
                   type="file"
                   accept="audio/*"
                   onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                   className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium hover:file:bg-emerald-100 dark:file:bg-emerald-900/20 dark:file:text-emerald-400"
                 />
               </div>
               <div>
                 <label className="block text-xs text-neutral-500 dark:text-neutral-400 mb-1">Cover Image (optional)</label>
                 <input
                   type="file"
                   accept="image/*"
                   onChange={(e) => setSelectedImage(e.target.files[0] || null)}
                   className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-400"
                 />
               </div>
             </div>

             <div className="flex gap-2">
               <button
                 onClick={(e) => {
                    e.stopPropagation();
                    saveEdit();
                 }}
                 className="bg-emerald-500 text-white px-3 py-1 rounded text-sm hover:bg-emerald-600 transition-colors"
               >
                 Save
               </button>
               <button
                 onClick={(e) => {
                    e.stopPropagation();
                    cancelEditing();
                 }}
                 className="bg-neutral-500 text-white px-3 py-1 rounded text-sm hover:bg-neutral-600 transition-colors"
               >
                 Cancel
               </button>
             </div>
           </div>
         ) : (
           <>
             <h3 className="font-bold text-neutral-800 dark:text-white font-mono truncate text-lg">
               {song.title}
             </h3>
             <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate uppercase tracking-wider flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
               <Link
                 href={`/artist/${encodeURIComponent(song.author)}`}
                 onClick={(e) => e.stopPropagation()}
                 className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors"
               >
                 {song.author}
               </Link>
             </div>
           </>
         )}
       </div>
    </div>
  );

  // --- RENDER (Sử dụng UI từ Stash) ---
  return (
    <div className="h-full w-full p-4 md:p-6 pb-[120px] overflow-y-auto bg-neutral-100 dark:bg-black transition-colors duration-500">
       
       {/* 1. HEADER SECTION */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8 border-b border-neutral-300 dark:border-white/10 pb-6">
          <div className="space-y-2">
             <h1 className="text-3xl md:text-4xl font-black font-mono tracking-tighter text-neutral-900 dark:text-white">
                <GlitchText text="MY_COLLECTION" />
             </h1>
             <p className="text-xs font-mono text-emerald-600 dark:text-emerald-500 tracking-[0.2em] uppercase">
                // Manage your personal uploads & tuned tracks
             </p>
          </div>

          <div className="flex bg-neutral-200 dark:bg-white/5 p-1 rounded-lg">
             <button 
                onClick={() => { setActiveTab('uploads'); setFilter('all'); }}
                className={`px-4 py-2 rounded-md text-xs font-mono font-bold uppercase transition-all
                ${activeTab === 'uploads' 
                   ? 'bg-white dark:bg-emerald-500 text-black dark:text-white shadow-md' 
                   : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
             >
                My Uploads
             </button>
             <button 
                onClick={() => { setActiveTab('tuned'); setFilter('all'); }}
                className={`px-4 py-2 rounded-md text-xs font-mono font-bold uppercase transition-all
                ${activeTab === 'tuned' 
                   ? 'bg-white dark:bg-emerald-500 text-black dark:text-white shadow-md' 
                   : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white'}`}
             >
                Tuned Songs
             </button>
          </div>
       </div>

       {/* 2. CONTENT GRID */}
       <div className="min-h-[300px]">
          {loading ? (
             <ContentSkeleton />
          ) : (
             songs.length > 0 || activeTab === 'uploads' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                   {activeTab === 'uploads' && (
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                          {/* Filter Slider */}
                          <div className="flex p-1 bg-neutral-200 dark:bg-white/5 rounded-lg w-fit border border-neutral-300 dark:border-white/10">
                              <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase transition-all ${filter === 'all' ? 'bg-white dark:bg-neutral-800 shadow-sm text-black dark:text-white font-bold' : 'text-neutral-500 hover:text-black dark:hover:text-white'}`}>
                                  <LayoutGrid size={12} className="inline mr-1 mb-0.5"/> All ({songs.length})
                              </button>
                              <button onClick={() => setFilter('public')} className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase transition-all ${filter === 'public' ? 'bg-white dark:bg-neutral-800 shadow-sm text-emerald-600 dark:text-emerald-500 font-bold' : 'text-neutral-500 hover:text-emerald-500'}`}>
                                  <Globe size={12} className="inline mr-1 mb-0.5"/> Public ({songs.filter(s => s.is_public).length})
                              </button>
                              <button onClick={() => setFilter('private')} className={`px-3 py-1.5 rounded text-[10px] font-mono uppercase transition-all ${filter === 'private' ? 'bg-white dark:bg-neutral-800 shadow-sm text-red-600 dark:text-red-500 font-bold' : 'text-neutral-500 hover:text-red-500'}`}>
                                  <Lock size={12} className="inline mr-1 mb-0.5"/> Private ({songs.filter(s => !s.is_public).length})
                              </button>
                          </div>
                          
                          <span className="hidden md:inline text-[10px] font-mono text-neutral-400 uppercase tracking-wide opacity-50">HOVER CARD TO RECONFIGURE</span>
                      </div>
                   )}

                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {/* Filtered Song List */}
                      {filteredSongs.map((song) => (
                         <UserSongCard 
                           key={song.id} 
                           song={song} 
                           isEditing={editingSong === song.id}
                           // isEditable mặc định là true vì ở trang này user sở hữu bài hát
                         />
                      ))}
                      
                      {/* Add New Button Card (ALWAYS VISIBLE in Uploads Tab) */}
                      {activeTab === 'uploads' && (
                         <button onClick={onOpen} className="group flex flex-col items-center justify-center gap-4 p-4 py-[9rem] rounded-xl border-2 border-dashed border-neutral-300 dark:border-white/10 hover:border-emerald-500 bg-transparent hover:bg-emerald-500/5 transition-all cursor-pointer min-h-[300px]">
                            <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/5 group-hover:bg-emerald-500 group-hover:text-white flex items-center justify-center text-neutral-400 transition-colors shadow-sm">
                                <Upload size={24}/>
                            </div>
                            <span className="text-xs font-mono font-bold uppercase text-neutral-500 group-hover:text-emerald-500 tracking-wider">Initialize Upload</span>
                         </button>
                      )}
                   </div>
                   
                   {/* Empty State for Filters */}
                   {filteredSongs.length === 0 && filter !== 'all' && (
                       <div className="py-20 text-center text-neutral-500 dark:text-neutral-600 font-mono text-xs uppercase">
                           [NO_RESULTS_FOR_FILTER: {filter}]
                       </div>
                   )}
                </div>
             ) : (
                <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50 text-neutral-500">
                    <Music size={60} strokeWidth={1} />
                    <p className="font-mono text-sm uppercase tracking-widest">
                        {activeTab === 'uploads' ? "NO_UPLOADS_DETECTED" : "NO_TUNED_DATA_FOUND"}
                    </p>
                    {activeTab === 'uploads' && (
                        <GlitchButton onClick={onOpen} className="text-xs py-2 px-6">UPLOAD_FIRST_TRACK</GlitchButton>
                    )}
                </div>
             )
          )}
       </div>
    </div>
  );
};

export default MyUploadsPage;