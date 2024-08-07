import React, { useEffect, useRef, useState } from "react";
import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import XHRUpload from "@uppy/xhr-upload";
import "@uppy/core/dist/style.css";
import "@uppy/dashboard/dist/style.css";
import "./UploadPage.css";
import logo from './assets/BCID_H_rgb_pos.png';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { ClipLoader } from "react-spinners"; // Import the spinner component

const UploadPage = () => {
  const uppyRef = useRef(null);
  const [loading, setLoading] = useState(false); // State to manage loading

  useEffect(() => {
    const uppy = new Uppy({
      id: 'uppy',
      autoProceed: false,
      restrictions: {
        maxNumberOfFiles: 1,
      }
    }).use(Dashboard, {
      inline: true,
      target: '#uppy-dashboard',
      showProgressDetails: true,
      height: 400
    });

    uppy.on('upload', () => {
      setLoading(true); // Show loading when upload starts
    });

    uppy.on('complete', async (result) => {
      const file = result.successful[0].data;
      const fileType = file.type;
      console.log('Uppy file data:', file);

      try {
        // Send file to /meta endpoint
        const metaResponse = await axios.put('http://localhost:5173/tika/tika', file, {
          headers: {
            'Content-Type': fileType,
            'Accept': 'application/json',
          },
          onUploadProgress: progressEvent => {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            console.log(`Meta upload progress: ${progress}%`);
          }
        });
        const metadata = metaResponse.data;

        // Send file to /tika endpoint for cleaned content
        const cleanedContentResponse = await axios.put('http://localhost:5173/tika/tika', file, {
          headers: {
            'Content-Type': fileType,
            'Accept': 'text/plain',
          },
          onUploadProgress: progressEvent => {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            console.log(`Content upload progress: ${progress}%`);
          }
        });
        const cleanedContent = cleanedContentResponse.data;

        // Combine metadata and cleaned content
        const combinedData = {
          ...metadata,
          'X-TIKA:content': cleanedContent, // Replacing original X-TIKA:content
          'id': uuidv4()
        };

        // Send combined data to Meilisearch
        // await axios.post('http://localhost:7700/indexes/uppy/documents', combinedData);
        await axios.post('https://test.doc.search.apps.silver.devops.gov.bc.ca/indexes/uppy/documents', combinedData);

        console.log('Original response from Tika:', metadata);
        console.log('Cleaned content:', cleanedContent);
        console.log('Combined data sent to Meilisearch:', combinedData);

        // Handle success (e.g., notify the user)
        alert('Document uploaded and indexed successfully!');
      } catch (error) {
        console.error('Error handling upload response:', error);
        alert('There was an error uploading or indexing the document.');
      } finally {
        setLoading(false); // Hide loading when upload completes or fails
      }
    });

    uppyRef.current = uppy;

    return () => {
      uppy.close();
    };
  }, []);

  return (
    <div className="upload-page">
      <div className="upload-header">
        <img src={logo} alt="Logo" className="upload-header-logo" />
        <h1>Document Upload</h1>
        <button onClick={() => window.location.href = "/"} className="upload-upload-button">Back to Search</button>
      </div>
      <div id="uppy-dashboard"></div>
      {loading && (
        <div className="loading-indicator">
          <ClipLoader color="#123abc" loading={loading} size={50} />
          <p>Uploading and processing file...</p>
        </div>
      )}
    </div>
  );
};

export default UploadPage;
