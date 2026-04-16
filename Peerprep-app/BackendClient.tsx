const API_BASE_URL = '/api/questions';

const getHeaders = () => ({
    'Content-Type': 'application/json',
});

export const fetchQuestions = async () => {
    const startTime = performance.now();
    
    const response = await fetch(`${API_BASE_URL}/`, {
        method: 'GET',
        credentials: 'include' ,
    });

    const endTime = performance.now(); // End timer
    console.log(`Response time: ${(endTime - startTime).toFixed(2)} ms`);

    if (!response.ok) throw new Error('Failed to fetch questions');
    
    const data = await response.json();
    return data.map((q: any) => ({ 
        ...q, id: q._id,
        topics: q.topics ?? [],
        imageUrls: q.imageUrls ?? []
     })); 
};

export const createQuestion = async (questionData: any) => {
    const response = await fetch(`${API_BASE_URL}/`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(questionData)
    });
    if (!response.ok) throw new Error('Failed to create question');
    return response.json();
};

export const updateQuestion = async (id: string, questionData: object) => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(questionData)
    });
    if (!response.ok) throw new Error('Failed to update question');
    return response.json();
};

export const deleteQuestion = async (id: string) => {
    const response = await fetch(`${API_BASE_URL}/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
        credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to delete question');
    return response.json();
};
