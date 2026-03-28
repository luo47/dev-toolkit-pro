import "./code-snippets/highlight";
import { useAppStore } from "../store";
import { SnippetFilterBar, SnippetGrid, SnippetToolbar } from "./code-snippets/CodeSnippetsToolSections";
import ShareConfirmDialog from "./code-snippets/ShareConfirmDialog";
import SnippetEditorModal from "./code-snippets/SnippetEditorModal";
import { useCodeSnippetsToolController } from "./code-snippets/useCodeSnippetsToolController";

export default function CodeSnippetsTool() {
  const { isDarkMode, showToast } = useAppStore();
  const {
    activeTag,
    allTags,
    cancelEdit,
    codeRefs,
    copiedId,
    copyShareLink,
    editingId,
    formData,
    handleCopy,
    handleDelete,
    handleLanguageChange,
    handleShare,
    handleSortChange,
    handleTagClick,
    isCreating,
    isLangOpen,
    langRef,
    langSearch,
    languageFilter,
    languages,
    loading,
    search,
    setActiveTag,
    setFormData,
    setIsLangOpen,
    setLangSearch,
    setSearch,
    shareConfirmData,
    setShareConfirmData,
    sharingId,
    snippets,
    sortValue,
    startCreate,
    startEdit,
    textareaRef,
    saveSnippet,
  } = useCodeSnippetsToolController(showToast);

  return (
    <div className="flex flex-col h-full gap-1.5">
      <SnippetToolbar
        search={search}
        sortValue={sortValue}
        onSearchChange={setSearch}
        onSortChange={handleSortChange}
        onCreate={startCreate}
      />

      <SnippetFilterBar
        allTags={allTags}
        activeTag={activeTag}
        languageFilter={languageFilter}
        languages={languages}
        onLanguageChange={handleLanguageChange}
        onTagClick={handleTagClick}
        onClearTag={() => setActiveTag("")}
      />

      {(isCreating || editingId) && (
        <SnippetEditorModal
          formData={formData}
          isCreating={isCreating}
          isDarkMode={isDarkMode}
          isLangOpen={isLangOpen}
          langRef={langRef}
          langSearch={langSearch}
          textareaRef={textareaRef}
          onCancel={cancelEdit}
          onLangOpenChange={setIsLangOpen}
          onLangSearchChange={setLangSearch}
          onSave={saveSnippet}
          onUpdateFormData={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
        />
      )}

      <SnippetGrid
        loading={loading}
        snippets={snippets}
        activeTag={activeTag}
        copiedId={copiedId}
        sharingId={sharingId}
        codeRefs={codeRefs}
        onCopy={handleCopy}
        onDelete={handleDelete}
        onEdit={startEdit}
        onShare={handleShare}
        onTagClick={handleTagClick}
      />

      {shareConfirmData && (
        <ShareConfirmDialog
          shareConfirmData={shareConfirmData}
          onCancel={() => setShareConfirmData(null)}
          onCopyLink={copyShareLink}
          onUpdateShare={(snippet) => handleShare(snippet, true)}
        />
      )}
    </div>
  );
}
