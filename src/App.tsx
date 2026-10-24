import courseData from "./data/courses.json"

function App() {
    const courses = courseData.courses;

    return (
        <main>
            <h1>OSU CSE Degree Visualizer</h1>
            <p>Loaded {courses.length} courses successfully.</p>

            <ul>
                {courses.map((course) => (
                    <li key={course.id}>
                        <strong>{course.id}</strong>: {course.title} ({course.credits} credits)
                    </li>
                ))}
            </ul>
        </main>
    );
}

export default App
