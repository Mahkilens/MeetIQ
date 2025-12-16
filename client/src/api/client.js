import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000",
  timeout: 60000
});

export async function uploadMeetingFile({ file, summaryMode }) {
  const form = new FormData();
  form.append("file", file);
  form.append("summaryMode", summaryMode);

  const { data } = await api.post("/api/upload", form, {
    headers: { "Content-Type": "multipart/form-data" }
  });

  return data;
}

export async function getMeeting(meetingId) {
  const { data } = await api.get(`/api/meetings/${meetingId}`);
  return data;
}
