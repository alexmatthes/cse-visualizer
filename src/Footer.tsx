
function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer>
            <hr />
            <div style={{ textAlign: 'center' }}>
                <p>
                    &copy; {currentYear} Alex Matthes. All rights reserved.
                </p>
            </div>
        </footer>
    );
}

export default Footer
