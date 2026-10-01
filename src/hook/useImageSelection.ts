import { useEffect, useRef, useState } from "react";

import { MAX_IMAGE_BYTES, MAX_IMAGE_COUNT } from "@/type/casting";

export function useImageSelection() {
  const previewUrlsRef = useRef<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [duplicateIndexes, setDuplicateIndexes] = useState<number[]>([]);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(
    () => () => previewUrlsRef.current.forEach(URL.revokeObjectURL),
    [],
  );

  const addFiles = (newFiles: File[]) => {
    const valid: File[] = [];
    const tooLarge: string[] = [];

    for (const file of newFiles) {
      if (file.size > MAX_IMAGE_BYTES) tooLarge.push(file.name);
      else valid.push(file);
    }

    const room = Math.max(0, MAX_IMAGE_COUNT - files.length);
    const accepted = valid.slice(0, room);
    const overflowCount = valid.length - accepted.length;
    const messages: string[] = [];

    if (tooLarge.length > 0) {
      messages.push(`${tooLarge.join(", ")} 파일이 10MB를 초과해 제외됐어요.`);
    }

    if (overflowCount > 0) {
      messages.push(
        `이미지는 최대 ${MAX_IMAGE_COUNT}장까지 올릴 수 있어요. ${overflowCount}장은 제외됐어요.`,
      );
    }

    setDuplicateIndexes([]);

    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
      setPreviewUrls((current) => [
        ...current,
        ...accepted.map(URL.createObjectURL),
      ]);
    }

    return {
      message: messages.length > 0 ? messages.join(" ") : null,
      addedCount: accepted.length,
    };
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setFiles((current) => current.filter((_, at) => at !== index));
    setPreviewUrls((current) => current.filter((_, at) => at !== index));
    setDuplicateIndexes([]);
  };

  const clearFiles = () => {
    previewUrls.forEach(URL.revokeObjectURL);
    setFiles([]);
    setPreviewUrls([]);
    setDuplicateIndexes([]);
  };

  return {
    files,
    previewUrls,
    duplicateIndexes,
    setDuplicateIndexes,
    addFiles,
    removeFile,
    clearFiles,
  };
}
